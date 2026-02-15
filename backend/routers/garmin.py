from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import Session, select
from datetime import date, datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel

from backend.database import get_session
from backend.models import User, GarminCredentials, HeartRateLog
from backend.auth import get_current_user

import garminconnect
import garth
import os
import shutil

router = APIRouter(prefix="/garmin", tags=["garmin"])

class GarminLinkRequest(BaseModel):
    email: str
    password: str

@router.post("/link")
def link_account(
    data: GarminLinkRequest,
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    # Verify credentials by attempting to login
    try:
        # We target the default garth token directory
        token_dir = os.path.expanduser("~/.garth")

        # Try to use saved tokens first (from manual authentication script)
        client = garminconnect.Garmin(data.email, data.password)
        if os.path.exists(token_dir) and os.path.exists(os.path.join(token_dir, "oauth1_token.json")):
            print(f"Loading saved Garmin tokens from {token_dir}")
            try:
                client.login(tokenstore=token_dir)
            except Exception as token_err:
                print(f"Token load failed: {token_err}, falling back to credential login")
                client.login()
        else:
            print("No saved tokens found, attempting credential login")
            client.login()
    except Exception as e:
        # Log the error for debugging?
        print(f"Garmin login failed: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to authenticate with Garmin: {str(e)}")

    # Store credentials
    creds = session.exec(select(GarminCredentials).where(GarminCredentials.user_id == current_user.id)).first()
    if not creds:
        creds = GarminCredentials(user_id=current_user.id, email=data.email, password=data.password)
        session.add(creds)
    else:
        creds.email = data.email
        creds.password = data.password
        session.add(creds)
    
    session.commit()
    return {"message": "Garmin account linked successfully"}

@router.get("/status")
def get_link_status(
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    creds = session.exec(select(GarminCredentials).where(GarminCredentials.user_id == current_user.id)).first()
    return {"linked": creds is not None, "email": creds.email if creds else None}

@router.post("/sync")
def sync_data(
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    creds = session.exec(select(GarminCredentials).where(GarminCredentials.user_id == current_user.id)).first()
    if not creds:
        raise HTTPException(status_code=400, detail="Garmin account not linked")

    try:
        # Target default garth token directory
        token_dir = os.path.expanduser("~/.garth")
        
        # Try to use saved tokens first (from manual authentication script)
        client = garminconnect.Garmin(creds.email, creds.password)
        if os.path.exists(token_dir) and os.path.exists(os.path.join(token_dir, "oauth1_token.json")):
            print(f"Loading saved Garmin tokens from {token_dir}")
            try:
                client.login(tokenstore=token_dir)
            except Exception as token_err:
                print(f"Token load failed: {token_err}, falling back to credential login")
                client.login()
        else:
            print("No saved tokens found, attempting credential login")
            client.login()
        
        # Sync today's data by default
        today = date.today()
        # Garmin API expects YYYY-MM-DD
        heart_rates = client.get_heart_rates(today.isoformat())
        
        # Structure of heart_rates: {'heartRateValues': [[timestamp_ms, value], ...]}
        count = 0
        if heart_rates and 'heartRateValues' in heart_rates:
            values = heart_rates['heartRateValues']
            # Filter out null entries
            valid_values = [v for v in values if v and len(v) >= 2 and v[0] is not None and v[1] is not None]
            print(f"Garmin API returned {len(values)} total entries, {len(valid_values)} valid entries for {today.isoformat()}")
            if valid_values:
                first_ts = datetime.fromtimestamp(valid_values[0][0] / 1000.0)
                last_ts = datetime.fromtimestamp(valid_values[-1][0] / 1000.0)
                print(f"Data range: {first_ts} to {last_ts}")
                
                # Delete existing entries for today and replace with fresh data
                start_of_day = datetime.combine(today, datetime.min.time())
                end_of_day = datetime.combine(today, datetime.max.time())
                
                existing_logs = session.exec(
                    select(HeartRateLog)
                    .where(HeartRateLog.user_id == current_user.id)
                    .where(HeartRateLog.timestamp >= start_of_day)
                    .where(HeartRateLog.timestamp <= end_of_day)
                ).all()
                
                old_count = len(existing_logs)
                for log in existing_logs:
                    session.delete(log)
                
                # Insert all valid values from Garmin
                for entry in valid_values:
                    ts_ms = entry[0]
                    hr_val = entry[1]
                    ts = datetime.fromtimestamp(ts_ms / 1000.0)
                    log = HeartRateLog(user_id=current_user.id, timestamp=ts, heart_rate=hr_val)
                    session.add(log)
                    count += 1
                
                session.commit()
                print(f"Replaced {old_count} old entries with {count} fresh entries")
                
        return {"message": f"Synced {count} heart rate data points for today (range: {first_ts.strftime('%H:%M') if count else '?'} – {last_ts.strftime('%H:%M') if count else '?'})"}
        
    except Exception as e:
        print(f"Sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Garmin sync failed: {str(e)}")

@router.get("/heart-rate")
def get_heart_rate(
    date_str: Optional[str] = None,
    current_user: User = Depends(get_current_user), 
    session: Session = Depends(get_session)
):
    if not date_str:
        target_date = date.today()
    else:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
             raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
             
    start_of_day = datetime.combine(target_date, datetime.min.time())
    end_of_day = datetime.combine(target_date, datetime.max.time())
    
    logs = session.exec(
        select(HeartRateLog)
        .where(HeartRateLog.user_id == current_user.id)
        .where(HeartRateLog.timestamp >= start_of_day)
        .where(HeartRateLog.timestamp <= end_of_day)
        .order_by(HeartRateLog.timestamp)
    ).all()
    
    return [
        {"timestamp": log.timestamp.isoformat(), "heart_rate": log.heart_rate}
        for log in logs
    ]

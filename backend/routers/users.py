from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from backend.database import get_session
from backend.models import User, UserRead
from backend.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserRead)
async def read_users_me(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    # 1. Calculate XP for ALL users to determine percentile
    # This is a bit inefficient for large scale, but fine for now.
    # ideally we'd cache this or update a 'total_xp' field on User model.
    
    users = session.exec(select(User)).all()
    user_xps = []
    
    for u in users:
        total_xp = 0
        for s in u.sessions:
            # Base XP
            total_xp += 100 
            # Exercises XP (10 per exercise)
            total_xp += len(s.exercises) * 10
            # Sets XP (5 per completed set)
            for ex in s.exercises:
                 # We need to check if 'sets' are loaded or query them.
                 # With SQLModel relationships, accessing .sets should lazy load if attached to session
                 count_completed = sum(1 for set_ in ex.sets if set_.completed)
                 total_xp += count_completed * 5
        user_xps.append(total_xp)
    
    # Calculate current user's XP again to be sure (or find it in the list)
    # We can just match by index, but let's be safe.
    current_user_xp = 0
    for s in current_user.sessions:
        current_user_xp += 100
        current_user_xp += len(s.exercises) * 10
        for ex in s.exercises:
             count_completed = sum(1 for set_ in ex.sets if set_.completed)
             current_user_xp += count_completed * 5

    # Calculate percentile
    # Percentile = (Number of people with LESS XP / Total number of people) * 100
    if not user_xps:
        percentile = 0.0
    else:
        filetered_xps = [xp for xp in user_xps if xp < current_user_xp]
        percentile = (len(filetered_xps) / len(user_xps)) * 100

    # Ensure we return a UserRead compatible object with the extra field
    # UserRead inherits UserBase, so we convert User -> UserRead and add field
    user_read = UserRead.model_validate(current_user)
    user_read.xp_percentile = round(percentile, 1)
    
    return user_read

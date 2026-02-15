"""
Manual Garmin Authentication Script
Uses garth directly for better control over the MFA/2FA flow.
"""
import getpass
import os
import shutil
import re

import garth
from garth import sso, http


def main():
    print("=== Garmin Manual Authentication ===")
    print("This script authenticates with Garmin Connect and saves session tokens.")
    print("If you receive a security code (Sicherheitscode) via email,")
    print("you will be prompted to enter it here.")
    print("")

    email = input("Enter your Garmin email: ")
    password = getpass.getpass("Enter your Garmin password: ")

    # Step 1: Clear ALL existing tokens
    paths_to_clear = [
        os.path.expanduser("~/.garth"),
        os.path.join(os.getcwd(), ".garth"),
        os.path.join(os.getcwd(), ".garmin_tokens"),
    ]
    for path in paths_to_clear:
        if os.path.exists(path):
            print(f"  Clearing old tokens: {path}")
            try:
                shutil.rmtree(path)
            except Exception as e:
                print(f"  Warning: Could not clear {path}: {e}")

    # Step 2: Create a fresh garth client
    client = http.Client()

    print("\nStep 1: Logging in to Garmin SSO...")

    # Step 3: Perform SSO login manually for full control
    SSO = f"https://sso.{client.domain}/sso"
    SSO_EMBED = f"{SSO}/embed"
    SSO_EMBED_PARAMS = dict(
        id="gauth-widget",
        embedWidget="true",
        gauthHost=SSO,
    )
    SIGNIN_PARAMS = {
        **SSO_EMBED_PARAMS,
        **dict(
            gauthHost=SSO_EMBED,
            service=SSO_EMBED,
            source=SSO_EMBED,
            redirectAfterAccountLoginUrl=SSO_EMBED,
            redirectAfterAccountCreationUrl=SSO_EMBED,
        ),
    }

    try:
        # Set cookies
        client.get("sso", "/sso/embed", params=SSO_EMBED_PARAMS)

        # Get CSRF token
        client.get("sso", "/sso/signin", params=SIGNIN_PARAMS, referrer=True)
        csrf_token = sso.get_csrf_token(client.last_resp.text)

        # Submit login form
        print("Step 2: Submitting credentials...")
        client.post(
            "sso",
            "/sso/signin",
            params=SIGNIN_PARAMS,
            referrer=True,
            data=dict(
                username=email,
                password=password,
                embed="true",
                _csrf=csrf_token,
            ),
        )

        title = sso.get_title(client.last_resp.text)
        print(f"Step 3: Response title: '{title}'")

        # Check for MFA / verification code page
        if title != "Success":
            # Could be MFA, could be a verification code page
            print(f"\n  Garmin requires additional verification (page title: '{title}')")
            print("  Check your email for a security code (Sicherheitscode).")
            
            # Try to handle it as MFA
            csrf_token = sso.get_csrf_token(client.last_resp.text)
            mfa_code = input("\n  Enter your security code: ").strip()

            # Try the standard MFA endpoint
            client.post(
                "sso",
                "/sso/verifyMFA/loginEnterMfaCode",
                params=SIGNIN_PARAMS,
                referrer=True,
                data={
                    "mfa-code": mfa_code,
                    "embed": "true",
                    "_csrf": csrf_token,
                    "fromPage": "setupEnterMfaCode",
                },
            )

            title = sso.get_title(client.last_resp.text)
            print(f"  After code entry, title: '{title}'")

            if title != "Success":
                print(f"\n  ERROR: Login still not successful. Title: '{title}'")
                print("  The page content may help debug:")
                # Print a snippet of the response
                text = client.last_resp.text[:500]
                print(f"  {text}")
                return

        # Step 4: Complete login (get OAuth1 + OAuth2 tokens)
        print("Step 4: Retrieving OAuth tokens...")
        oauth1, oauth2 = sso._complete_login(client)

        # Set tokens on the client
        client.configure(oauth1_token=oauth1, oauth2_token=oauth2)

        # Step 5: Save tokens
        token_dir = os.path.expanduser("~/.garth")
        print(f"Step 5: Saving tokens to {token_dir}...")
        client.dump(token_dir)

        print("\n=== SUCCESS! ===")
        print("Your Garmin session has been saved.")
        print("You can now use 'Sync Now' in the Fitness Dashboard.")

    except Exception as e:
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\nPlease try again. If the issue persists, check:")
        print("  1. Your email and password are correct")
        print("  2. You can log in at https://connect.garmin.com")


if __name__ == "__main__":
    main()

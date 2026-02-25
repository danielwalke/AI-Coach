
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest
from backend.models import User, TrainingSession, SessionExercise
from backend.routers.users import read_users_me

def calculate_percentile(current_user_xp, all_user_xps):
    """
    Helper function replicating the logic in read_users_me
    Percentile = (Number of people with LESS XP / Total number of people) * 100
    """
    if not all_user_xps:
        return 0.0
    filtered_xps = [xp for xp in all_user_xps if xp < current_user_xp]
    return (len(filtered_xps) / len(all_user_xps)) * 100

def test_xp_percentile_logic():
    # Case 1: You are the best (100 XP vs 0 XP)
    # Total 2 users. You have 100. Other has 0.
    # Less than 100: 1 user (the other one).
    # 1 / 2 = 50%
    assert calculate_percentile(100, [0, 100]) == 50.0

    # Case 2: You are the worst (0 XP vs 100 XP)
    # Total 2 users. You have 0. Other has 100.
    # Less than 0: 0 users.
    # 0 / 2 = 0%
    assert calculate_percentile(0, [0, 100]) == 0.0

    # Case 3: You are the only user
    # Total 1 user. You have 100.
    # Less than 100: 0 users.
    # 0 / 1 = 0%  -> This might be counter-intuitive? "I am top 1%"?
    # If I am the only one, I am better than 0 people. 
    # But usually percentile implies rank.
    assert calculate_percentile(100, [100]) == 0.0

    # Case 4: Middle of the pack
    # Users: [10, 20, 30, 40, 50]. You are 30.
    # Less than 30: 10, 20 (2 users)
    # Total: 5
    # 2 / 5 = 40%
    assert calculate_percentile(30, [10, 20, 30, 40, 50]) == 40.0

    # Case 5: Many users with 0 XP, you have 100
    # Users: [0, 0, 0, 0, 0, 0, 0, 0, 0, 100] (You are the 100)
    # Less than 100: 9 users
    # Total: 10
    # 9 / 10 = 90%
    assert calculate_percentile(100, [0]*9 + [100]) == 90.0

if __name__ == "__main__":
    test_xp_percentile_logic()
    print("All XP logic tests passed!")

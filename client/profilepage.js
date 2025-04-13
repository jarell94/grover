import React, { useState, useEffect } from 'react';
import { getUserProfile } from '../services/api';

const ProfilePage = () => {
    const [profile, setProfile] = useState({});

    useEffect(() => {
        const fetchProfile = async () => {
            const data = await getUserProfile();
            setProfile(data);
        };
        fetchProfile();
    }, []);

    return (
        <div>
            <img src={profile.profilePicture} alt="Profile" />
            <h2>{profile.username}</h2>
            <p>{profile.bio}</p>
            <button>Edit Profile</button>
        </div>
    );
};

export default ProfilePage;

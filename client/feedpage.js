import React, { useState, useEffect } from 'react';
import { getFeed } from '../services/api';

const FeedPage = () => {
    const [posts, setPosts] = useState([]);

    useEffect(() => {
        const fetchFeed = async () => {
            const data = await getFeed();
            setPosts(data);
        };
        fetchFeed();
    }, []);

    return (
        <div>
            {posts.map(post => (
                <div key={post.id}>
                    <h3>{post.author}</h3>
                    <p>{post.content}</p>
                    <button>Like</button>
                    <button>Share</button>
                </div>
            ))}
        </div>
    );
};

export default FeedPage;

"""
Base Repository - Common database access patterns
"""
from typing import Optional, List, Dict, Any
from motor.motor_asyncio import AsyncIOMotorCollection


class BaseRepository:
    """Base repository with common CRUD operations"""
    
    def __init__(self, collection: AsyncIOMotorCollection):
        self.collection = collection
    
    async def find_one(
        self, 
        filter_dict: Dict[str, Any], 
        projection: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """Find a single document"""
        if projection is None:
            projection = {"_id": 0}
        return await self.collection.find_one(filter_dict, projection)
    
    async def find_many(
        self,
        filter_dict: Dict[str, Any],
        projection: Optional[Dict[str, Any]] = None,
        skip: int = 0,
        limit: int = 100,
        sort: Optional[List[tuple]] = None
    ) -> List[Dict[str, Any]]:
        """Find multiple documents"""
        if projection is None:
            projection = {"_id": 0}
        
        cursor = self.collection.find(filter_dict, projection)
        
        if sort:
            cursor = cursor.sort(sort)
        
        cursor = cursor.skip(skip).limit(limit)
        
        return await cursor.to_list(length=limit)
    
    async def insert_one(self, document: Dict[str, Any]) -> Any:
        """Insert a single document"""
        result = await self.collection.insert_one(document)
        return result.inserted_id
    
    async def update_one(
        self,
        filter_dict: Dict[str, Any],
        update_dict: Dict[str, Any]
    ) -> bool:
        """Update a single document"""
        result = await self.collection.update_one(filter_dict, update_dict)
        return result.modified_count > 0
    
    async def delete_one(self, filter_dict: Dict[str, Any]) -> bool:
        """Delete a single document"""
        result = await self.collection.delete_one(filter_dict)
        return result.deleted_count > 0
    
    async def count_documents(self, filter_dict: Dict[str, Any]) -> int:
        """Count documents matching filter"""
        return await self.collection.count_documents(filter_dict)

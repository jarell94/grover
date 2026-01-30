"""
Product Repository - Data access layer for product operations
"""
from typing import Optional, Dict, Any, List
from repositories.base import BaseRepository


class ProductRepository(BaseRepository):
    """Repository for product data access"""
    
    async def get_by_product_id(self, product_id: str) -> Optional[Dict[str, Any]]:
        """Get product by product_id"""
        return await self.find_one({"product_id": product_id})
    
    async def get_user_products(
        self, 
        user_id: str, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get products by user"""
        return await self.find_many(
            {"user_id": user_id},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    async def get_all_products(
        self, 
        skip: int = 0, 
        limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get all products"""
        return await self.find_many(
            {},
            skip=skip,
            limit=limit,
            sort=[("created_at", -1)]
        )
    
    async def create_product(self, product_data: Dict[str, Any]) -> Any:
        """Create a new product"""
        return await self.insert_one(product_data)
    
    async def update_product(self, product_id: str, update_data: Dict[str, Any]) -> bool:
        """Update product data"""
        return await self.update_one(
            {"product_id": product_id},
            {"$set": update_data}
        )
    
    async def delete_product(self, product_id: str) -> bool:
        """Delete a product"""
        return await self.delete_one({"product_id": product_id})

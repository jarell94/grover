import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

const Colors = {
  primary: '#8B5CF6',
  secondary: '#EC4899',
  background: '#0F172A',
  surface: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  success: '#10B981',
};

type ProductType = 'physical' | 'digital' | 'service';
type TabType = 'all' | 'digital' | 'services' | 'bundles';

interface Product {
  product_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  product_type: ProductType;
  digital_file_url?: string;
  service_duration?: number;
  image_url?: string;
  is_bundle?: boolean;
  bundle_items?: string[];
  discount_code?: string;
  discount_percent?: number;
  rating?: number;
  reviews_count?: number;
}

export default function MarketplaceScreen() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [discountModalVisible, setDiscountModalVisible] = useState(false);
  
  // Create Product State
  const [productType, setProductType] = useState<ProductType>('digital');
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState('');
  const [productPrice, setProductPrice] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [creating, setCreating] = useState(false);
  
  // Discount Code State
  const [discountCode, setDiscountCode] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountExpiry, setDiscountExpiry] = useState('');

  useEffect(() => {
    loadProducts();
  }, [activeTab]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts();
      
      // Filter based on active tab
      let filtered = data;
      if (activeTab === 'digital') {
        filtered = data.filter((p: Product) => p.product_type === 'digital');
      } else if (activeTab === 'services') {
        filtered = data.filter((p: Product) => p.product_type === 'service');
      } else if (activeTab === 'bundles') {
        filtered = data.filter((p: Product) => p.is_bundle);
      }
      
      setProducts(filtered);
    } catch (error) {
      console.error('Load products error:', error);
      Alert.alert('Error', 'Failed to load products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const createProduct = async () => {
    if (!productName.trim() || !productDescription.trim() || !productPrice) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    try {
      setCreating(true);
      const formData = new FormData();
      formData.append('name', productName.trim());
      formData.append('description', productDescription.trim());
      formData.append('price', productPrice);
      formData.append('product_type', productType);
      
      if (selectedImage) {
        const blob = {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: 'product.jpg',
        };
        formData.append('image', blob as any);
      }

      await api.createProduct(formData);
      setProductName('');
      setProductDescription('');
      setProductPrice('');
      setSelectedImage(null);
      setCreateModalVisible(false);
      loadProducts();
      Alert.alert('Success', `${productType === 'digital' ? 'Digital product' : productType === 'service' ? 'Service' : 'Product'} created!`);
    } catch (error) {
      console.error('Create product error:', error);
      Alert.alert('Error', 'Failed to create product');
    } finally {
      setCreating(false);
    }
  };

  const createDiscountCode = () => {
    if (!discountCode.trim() || !discountPercent) {
      Alert.alert('Error', 'Please enter code and discount percentage');
      return;
    }
    
    // This would call an API endpoint to create discount code
    Alert.alert('Success', `Discount code "${discountCode}" created with ${discountPercent}% off!`);
    setDiscountCode('');
    setDiscountPercent('');
    setDiscountExpiry('');
    setDiscountModalVisible(false);
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => Alert.alert(item.name, item.description)}
    >
      {item.image_url && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.image_url}` }}
          style={styles.productImage}
        />
      )}
      
      <View style={styles.productContent}>
        <View style={styles.productHeader}>
          <View style={styles.productTypeContainer}>
            <View style={[styles.productTypeBadge, 
              item.product_type === 'digital' && { backgroundColor: Colors.primary + '20' },
              item.product_type === 'service' && { backgroundColor: Colors.success + '20' },
              item.is_bundle && { backgroundColor: Colors.secondary + '20' }
            ]}>
              <Ionicons 
                name={
                  item.is_bundle ? 'gift' :
                  item.product_type === 'digital' ? 'download' :
                  item.product_type === 'service' ? 'calendar' :
                  'cube'
                } 
                size={14} 
                color={
                  item.is_bundle ? Colors.secondary :
                  item.product_type === 'digital' ? Colors.primary :
                  item.product_type === 'service' ? Colors.success :
                  Colors.text
                } 
              />
              <Text style={[styles.productTypeText,
                item.product_type === 'digital' && { color: Colors.primary },
                item.product_type === 'service' && { color: Colors.success },
                item.is_bundle && { color: Colors.secondary }
              ]}>
                {item.is_bundle ? 'Bundle' :
                 item.product_type === 'digital' ? 'Digital' :
                 item.product_type === 'service' ? 'Service' :
                 'Physical'
                }
              </Text>
            </View>
            {item.discount_percent && (
              <View style={styles.discountBadge}>
                <Text style={styles.discountText}>-{item.discount_percent}%</Text>
              </View>
            )}
          </View>
        </View>
        
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description}
        </Text>
        
        {item.rating && (
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={14} color="#F59E0B" />
            <Text style={styles.ratingText}>
              {item.rating.toFixed(1)} ({item.reviews_count || 0})
            </Text>
          </View>
        )}
        
        <View style={styles.productFooter}>
          <View>
            <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
            {item.service_duration && (
              <Text style={styles.serviceDuration}>
                {item.service_duration} min session
              </Text>
            )}
          </View>
          <TouchableOpacity style={styles.buyButton}>
            <Ionicons name="cart" size={18} color="#fff" />
            <Text style={styles.buyButtonText}>
              {item.product_type === 'service' ? 'Book' : 'Buy'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8B5CF6', '#EC4899', '#0EA5E9']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Marketplace</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setDiscountModalVisible(true)}>
              <Ionicons name="pricetag" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
              <Ionicons name="add-circle" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Tabs */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.tabsContainer}
        >
          {[{ id: 'all', label: 'All' }, { id: 'digital', label: 'Digital' }, { id: 'services', label: 'Services' }, { id: 'bundles', label: 'Bundles' }].map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id as TabType)}
            >
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={(item) => item.product_id}
          contentContainerStyle={styles.listContainer}
          numColumns={2}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadProducts();
          }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={80} color={Colors.textSecondary} />
              <Text style={styles.emptyTitle}>No Products Yet</Text>
              <Text style={styles.emptySubtitle}>
                Start selling digital products, services, or bundles
              </Text>
            </View>
          }
        />
      )}

      {/* Create Product Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Product</Text>
                <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                  <Ionicons name="close" size={24} color={Colors.text} />
                </TouchableOpacity>
              </View>

              {/* Product Type Selector */}
              <View style={styles.typeSelector}>
                {[{ type: 'digital', icon: 'download', label: 'Digital' }, 
                  { type: 'service', icon: 'calendar', label: 'Service' },
                  { type: 'physical', icon: 'cube', label: 'Physical' }].map((t) => (
                  <TouchableOpacity
                    key={t.type}
                    style={[styles.typeOption, productType === t.type && styles.typeOptionActive]}
                    onPress={() => setProductType(t.type as ProductType)}
                  >
                    <Ionicons 
                      name={t.icon as any} 
                      size={24} 
                      color={productType === t.type ? Colors.primary : Colors.textSecondary} 
                    />
                    <Text style={[styles.typeOptionText, productType === t.type && styles.typeOptionTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                placeholder="Product name"
                placeholderTextColor={Colors.textSecondary}
                value={productName}
                onChangeText={setProductName}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                placeholderTextColor={Colors.textSecondary}
                value={productDescription}
                onChangeText={setProductDescription}
                multiline
              />

              <TextInput
                style={styles.input}
                placeholder="Price ($)"
                placeholderTextColor={Colors.textSecondary}
                value={productPrice}
                onChangeText={setProductPrice}
                keyboardType="decimal-pad"
              />

              {selectedImage && (
                <View style={styles.selectedImageContainer}>
                  <Image source={{ uri: selectedImage.uri }} style={styles.selectedImage} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => setSelectedImage(null)}
                  >
                    <Ionicons name="close-circle" size={24} color={Colors.secondary} />
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
                <Ionicons name="image" size={20} color={Colors.primary} />
                <Text style={styles.imageButtonText}>Add Product Image</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={createProduct}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create Product</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Discount Code Modal */}
      <Modal
        visible={discountModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDiscountModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Discount Code</Text>
              <TouchableOpacity onPress={() => setDiscountModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Discount code (e.g., SAVE20)"
              placeholderTextColor={Colors.textSecondary}
              value={discountCode}
              onChangeText={setDiscountCode}
              autoCapitalize="characters"
            />

            <TextInput
              style={styles.input}
              placeholder="Discount percentage (e.g., 20)"
              placeholderTextColor={Colors.textSecondary}
              value={discountPercent}
              onChangeText={setDiscountPercent}
              keyboardType="number-pad"
            />

            <TextInput
              style={styles.input}
              placeholder="Expiry date (optional)"
              placeholderTextColor={Colors.textSecondary}
              value={discountExpiry}
              onChangeText={setDiscountExpiry}
            />

            <TouchableOpacity style={styles.createButton} onPress={createDiscountCode}>
              <Text style={styles.createButtonText}>Create Discount Code</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabActive: {
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: Colors.primary,
  },
  listContainer: {
    padding: 8,
  },
  productCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    margin: 8,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 120,
  },
  productContent: {
    padding: 12,
  },
  productHeader: {
    marginBottom: 8,
  },
  productTypeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  productTypeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text,
  },
  discountBadge: {
    backgroundColor: Colors.secondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  discountText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 16,
    marginBottom: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  serviceDuration: {
    fontSize: 10,
    color: Colors.textSecondary,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  buyButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalScroll: {
    maxHeight: '90%',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: Colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  typeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 6,
  },
  typeOptionTextActive: {
    color: Colors.primary,
  },
  input: {
    backgroundColor: Colors.background,
    color: Colors.text,
    fontSize: 16,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectedImageContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  selectedImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  imageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  imageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  createButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

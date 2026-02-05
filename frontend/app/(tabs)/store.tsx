import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, router } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import * as ImagePicker from 'expo-image-picker';

interface Product {
  product_id: string;
  user_id: string;
  name: string;
  description: string;
  price: number;
  image_url?: string;
  user?: any;
}

const getProductImageSource = (image_url?: string) => {
  if (!image_url) return null;
  if (image_url.startsWith("http")) return { uri: image_url };
  return { uri: `data:image/jpeg;base64,${image_url}` };
};

export default function StoreScreen() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  // Check if current user owns the selected product
  const isProductOwner = user?.user_id && selectedProduct?.user_id === user.user_id;

  useFocusEffect(
    useCallback(() => {
      loadProducts();
    }, [])
  );

  const loadProducts = async () => {
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Load products error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  const openCreateModal = async () => {
    // Check if user has PayPal email for receiving payouts
    const me = await api.getMe?.().catch(() => null);

    if (me && !me.paypal_email) {
      Alert.alert(
        "PayPal required",
        "Add your PayPal email in Profile → Edit Profile to receive payouts."
      );
      return;
    }
    setCreateModalVisible(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: false, // Don't need base64 since we're using FormData
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0]);
    }
  };

  const createProduct = async () => {
    if (!name.trim() || !description.trim() || !price.trim()) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', description);
      formData.append('price', price);

      if (selectedImage?.uri) {
        const uri = selectedImage.uri;
        // Infer file extension from URI
        const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
        const mimeType = fileExt === 'png' ? 'image/png' : fileExt === 'gif' ? 'image/gif' : 'image/jpeg';

        formData.append('image', {
          uri,
          name: `product.${fileExt}`,
          type: mimeType,
        } as any);
      }

      await api.createProduct(formData);
      setName('');
      setDescription('');
      setPrice('');
      setSelectedImage(null);
      setCreateModalVisible(false);
      loadProducts();
      Alert.alert('Success', 'Product created successfully!');
    } catch (error) {
      console.error('Create product error:', error);
      Alert.alert('Error', 'Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  const handleBuy = async (product: Product) => {
    try {
      // 1) ask backend to create PayPal payment
      // expected: { approval_url, payment_id }
      const checkout = await api.createPaypalCheckout(product.product_id);

      if (!checkout?.approval_url || !checkout?.payment_id) {
        Alert.alert("Error", "Checkout could not be created.");
        return;
      }

      // 2) open PayPal approval URL
      await Linking.openURL(checkout.approval_url);

      // 3) after user approves, your redirect should deep-link back
      // then your app calls execute + creates order.
      Alert.alert(
        "Complete payment",
        "After approving payment in PayPal, return to Grover to finish checkout."
      );
    } catch (error) {
      console.error("Buy error:", error);
      Alert.alert("Error", "Purchase failed");
    }
  };

  const handleEditProduct = () => {
    if (!selectedProduct) return;
    setDetailsVisible(false);
    router.push({ pathname: '/edit-product', params: { productId: selectedProduct.product_id } });
  };

  const handleDeleteProduct = () => {
    if (!selectedProduct) return;
    Alert.alert(
      'Delete Product',
      'Are you sure you want to delete this product? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteProduct(selectedProduct.product_id);
              setDetailsVisible(false);
              setSelectedProduct(null);
              loadProducts();
              Alert.alert('Success', 'Product deleted');
            } catch (e) {
              console.error('Delete product error:', e);
              Alert.alert('Error', 'Failed to delete product');
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => {
    const src = getProductImageSource(item.image_url);

    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.9}
        onPress={() => { setSelectedProduct(item); setDetailsVisible(true); }}
      >
        {src ? (
          <Image source={src} style={styles.productImage} />
        ) : (
        <View style={[styles.productImage, styles.noImage]}>
          <Ionicons name="image-outline" size={48} color={Colors.textSecondary} />
        </View>
      )}
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.productFooter}>
          <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
          <TouchableOpacity
            style={styles.buyButton}
            onPress={() => handleBuy(item)}
          >
            <Ionicons name="cart" size={20} color="#fff" />
            <Text style={styles.buyButtonText}>Buy</Text>
          </TouchableOpacity>
        </View>
        {item.user && (
          <View style={styles.sellerInfo}>
            <Image
              source={{ uri: item.user.picture || 'https://via.placeholder.com/24' }}
              style={styles.sellerAvatar}
            />
            <Text style={styles.sellerName}>{item.user.name}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Store</Text>
        <TouchableOpacity onPress={openCreateModal}>
          <Ionicons name="add-circle" size={32} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => String(item.product_id)}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cart-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No products yet</Text>
          </View>
        }
      />

      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Product</Text>
              <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Product Name"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={setName}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor={Colors.textSecondary}
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <TextInput
              style={styles.input}
              placeholder="Price ($)"
              placeholderTextColor={Colors.textSecondary}
              keyboardType="decimal-pad"
              value={price}
              onChangeText={setPrice}
            />

            {selectedImage && (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: selectedImage.uri }}
                  style={styles.previewImage}
                />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close-circle" size={32} color={Colors.error} />
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <Ionicons name="image-outline" size={24} color={Colors.primary} />
              <Text style={styles.imageButtonText}>Add Image</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, uploading && styles.submitButtonDisabled]}
              onPress={createProduct}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Create Product</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Product Details Modal */}
      <Modal
        visible={detailsVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Product</Text>
              <TouchableOpacity onPress={() => setDetailsVisible(false)}>
                <Ionicons name="close" size={28} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {selectedProduct && (
              <>
                {getProductImageSource(selectedProduct.image_url) ? (
                  <Image
                    source={getProductImageSource(selectedProduct.image_url)!}
                    style={styles.previewImage}
                  />
                ) : (
                  <View style={[styles.previewImage, styles.noImage]}>
                    <Ionicons name="image-outline" size={48} color={Colors.textSecondary} />
                  </View>
                )}

                <Text style={[styles.productName, { fontSize: 20, marginTop: 12 }]}>
                  {selectedProduct.name}
                </Text>
                <Text style={[styles.productPrice, { marginTop: 6 }]}>
                  ${selectedProduct.price.toFixed(2)}
                </Text>
                <Text style={{ color: Colors.textSecondary, marginTop: 10, lineHeight: 20 }}>
                  {selectedProduct.description}
                </Text>

                {selectedProduct.user && (
                  <View style={styles.sellerInfo}>
                    <Image
                      source={{ uri: selectedProduct.user.picture || "https://via.placeholder.com/24" }}
                      style={styles.sellerAvatar}
                    />
                    <Text style={styles.sellerName}>Sold by {selectedProduct.user.name}</Text>
                  </View>
                )}

                {/* Owner Actions */}
                {isProductOwner && (
                  <View style={styles.ownerActions}>
                    <TouchableOpacity
                      style={styles.editButton}
                      onPress={handleEditProduct}
                    >
                      <Ionicons name="pencil" size={18} color="#fff" />
                      <Text style={styles.editButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={handleDeleteProduct}
                    >
                      <Ionicons name="trash" size={18} color="#fff" />
                      <Text style={styles.deleteButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Buy button - only show if NOT owner */}
                {!isProductOwner && (
                  <TouchableOpacity
                    style={[styles.submitButton, { marginTop: 16 }]}
                    onPress={() => handleBuy(selectedProduct)}
                  >
                    <Text style={styles.submitButtonText}>Buy Now</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  grid: {
    padding: 16,
  },
  row: {
    gap: 16,
    marginBottom: 16,
  },
  productCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  productImage: {
    width: '100%',
    height: 150,
  },
  noImage: {
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  productFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  buyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  sellerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  sellerName: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 16,
  },
  previewImage: {
    width: '100%',
    height: 200,
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
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  imageButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

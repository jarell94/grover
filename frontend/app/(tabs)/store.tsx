import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { api } from '../../services/api';
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

export default function StoreScreen() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
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

      if (selectedImage) {
        formData.append('image', {
          uri: selectedImage.uri,
          type: 'image/jpeg',
          name: 'product.jpg',
        } as any);
      }

      await api.createProduct(formData);
      setName('');
      setDescription('');
      setPrice('');
      setSelectedImage(null);
      setCreateModalVisible(false);
      loadProducts();
    } catch (error) {
      console.error('Create product error:', error);
      Alert.alert('Error', 'Failed to create product');
    } finally {
      setUploading(false);
    }
  };

  const handleBuy = async (product: Product) => {
    Alert.alert(
      'Buy Product',
      `Purchase ${product.name} for $${product.price}?\n\nNote: PayPal credentials need to be configured by the admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              // Simulate PayPal order ID for now
              const paypalOrderId = `PAYPAL_${Date.now()}`;
              await api.createOrder(product.product_id, paypalOrderId);
              Alert.alert('Success', 'Purchase completed!');
            } catch (error) {
              Alert.alert('Error', 'Purchase failed');
            }
          },
        },
      ]
    );
  };

  const renderProduct = ({ item }: { item: Product }) => (
    <View style={styles.productCard}>
      {item.image_url ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${item.image_url}` }}
          style={styles.productImage}
        />
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
    </View>
  );

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
        <TouchableOpacity onPress={() => setCreateModalVisible(true)}>
          <Ionicons name="add-circle" size={32} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.product_id}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.row}
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
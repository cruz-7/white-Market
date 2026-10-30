import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, X, Search, Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { toast } from "sonner";
import { productsApi } from "./api";
import { compareImageSignatures, createImageSignature } from "./image-similarity";

interface ImageSearchResult {
  id: string;
  title: string;
  image_url: string;
  price: number;
  similarity: number;
  category: string | undefined;
}

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageSearchModal({ isOpen, onClose }: ImageSearchModalProps) {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ImageSearchResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      toast.error("Please select a valid image file");
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  }, [handleImageSelect]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  }, [handleImageSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const performImageSearch = async () => {
    if (!selectedImage) return;

    setIsSearching(true);
    setSearchResults([]);

    try {
      const signature = await createImageSignature(selectedImage);
      const response = await productsApi.getAll({ page: 1, limit: 50, is_active: true });
      if (response.error) throw new Error(response.error);

      const candidates = (response.data ?? []).filter((product) => product.image_url);
      const scored: ImageSearchResult[] = [];
      let unsupportedImages = 0;
      for (let start = 0; start < candidates.length; start += 4) {
        const batch = candidates.slice(start, start + 4);
        const results = await Promise.all(batch.map(async (product) => {
          try {
            const imageResponse = await fetch(product.image_url!, { mode: "cors" });
            if (!imageResponse.ok) throw new Error(`Image request failed (${imageResponse.status})`);
            const itemSignature = await createImageSignature(await imageResponse.blob());
            return {
              id: product.id,
              title: product.title,
              image_url: product.image_url!,
              price: product.price,
              category: product.category,
              similarity: compareImageSignatures(signature, itemSignature),
            };
          } catch (error) {
            unsupportedImages += 1;
            console.warn(`Skipped image-search candidate ${product.id}:`, error);
            return null;
          }
        }));
        scored.push(...results.filter((result): result is ImageSearchResult => result !== null));
      }

      const matches = scored.sort((a, b) => b.similarity - a.similarity).slice(0, 12);
      setSearchResults(matches);
      if (matches.length) {
        toast.success(`Compared ${scored.length} listing images on your device.`);
      } else if (unsupportedImages) {
        toast.error("Could not access listing images for local comparison. Check image hosting CORS settings.");
      } else {
        toast.info("No listings with images are available to compare.");
      }
    } catch (error) {
      console.error('Image search failed:', error);
      toast.error(error instanceof Error ? error.message : "Failed to search by image. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  const resetSearch = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setSearchResults([]);
    setIsSearching(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResultClick = (productId: string) => {
    onClose();
    navigate(`/product/${productId}`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <Card className="shadow-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Camera className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">Search with an Image</CardTitle>
                <p className="text-sm text-muted-foreground">Upload an image and describe the item to find matching listings</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6 max-h-[75vh] overflow-y-auto">
            {!selectedImage ? (
              // Image Upload Area
              <div
                className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Upload an image</h3>
                    <p className="text-muted-foreground">
                      Drag & drop or click to select a photo of what you're looking for
                    </p>
                  </div>
                  <div className="flex justify-center gap-2">
                    <Badge variant="secondary">JPG</Badge>
                    <Badge variant="secondary">PNG</Badge>
                    <Badge variant="secondary">WEBP</Badge>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </div>
            ) : (
              // Image Preview and Search
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Selected Image</h3>
                  <Button variant="outline" size="sm" onClick={resetSearch}>
                    <X className="h-4 w-4 mr-2" />
                    Change Image
                  </Button>
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Selected for search"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="p-4 bg-primary/5 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <span className="font-medium">Private, on-device visual matching</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Your image stays on this device. We compare visual color and shape patterns; no image is sent to an AI service.
                      </p>
                    </div>

                    <Button
                      onClick={performImageSearch}
                      disabled={isSearching}
                      className="w-full"
                      size="lg"
                    >
                      {isSearching ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Comparing listing images...
                        </>
                      ) : (
                        <>
                          <Search className="h-5 w-5 mr-2" />
                          Find Similar Images
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Matching Products</h3>
                  <Badge variant="secondary">{searchResults.length} results</Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {searchResults.map((result, index) => (
                    <Card
                      key={result.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                      onClick={() => handleResultClick(result.id)}
                    >
                      <div className="aspect-square bg-muted rounded-t-lg flex items-center justify-center overflow-hidden relative">
                        {result.image_url && result.image_url !== '/placeholder.svg' ? (
                          <img
                            src={result.image_url}
                            alt={result.title}
                            className="w-full h-full object-cover hover:scale-105 transition-transform"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <CardContent className="p-3">
                        <h4 className="font-medium text-sm mb-1 line-clamp-2">{result.title}</h4>
                        <p className="text-xs text-muted-foreground mb-2">{result.category}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-sm">GHS {result.price}</span>
                          <Badge variant="outline" className="text-xs whitespace-nowrap">
                            {Math.round(result.similarity * 100)}% visual match
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="text-center">
                  <Button variant="outline" onClick={() => navigate("/marketplace")}>
                    View All Products
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isSearching && searchResults.length === 0 && (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                <h3 className="text-lg font-semibold mb-2">Comparing Listing Images</h3>
                <p className="text-muted-foreground">
                  Comparing image color and shape patterns locally in batches...
                </p>
                <div className="mt-4 flex justify-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
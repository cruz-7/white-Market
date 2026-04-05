import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Upload, X, Search, Loader2, Image as ImageIcon, Sparkles } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Badge } from "./badge";
import { toast } from "sonner";
import { searchApi } from "./api";

interface ImageSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImageSearchModal({ isOpen, onClose }: ImageSearchModalProps) {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
      const response = await searchApi.searchByImage(selectedImage);

      if (response.error) {
        toast.error(response.error || "Failed to search by image");
        return;
      }

      if (response.data?.results) {
        // Transform API results to match component expectations
        const transformedResults = response.data.results.map(result => ({
          id: result.id,
          title: result.title,
          image_url: result.image_url || '/placeholder.svg',
          price: result.price,
          similarity: result.similarity,
          category: result.category
        }));
        setSearchResults(transformedResults);
        toast.success(`Found ${response.data.results.length} similar items!`);
      } else {
        toast.info("No similar products found. Try a different image.");
      }
    } catch (error) {
      console.error('Image search failed:', error);
      toast.error("Failed to search by image. Please try again.");
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
                <CardTitle className="text-xl">Search by Image</CardTitle>
                <p className="text-sm text-muted-foreground">Upload a photo to find similar products</p>
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
                        <span className="font-medium">AI-Powered Search</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Our system will analyze your image and find visually similar products from our marketplace.
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
                          Analyzing Image...
                        </>
                      ) : (
                        <>
                          <Search className="h-5 w-5 mr-2" />
                          Search Similar Items
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
                  <h3 className="text-lg font-semibold">Similar Products Found</h3>
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
                            {Math.round(result.similarity * 100)}% match
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
                <h3 className="text-lg font-semibold mb-2">Analyzing Your Image</h3>
                <p className="text-muted-foreground">
                  Extracting visual features and searching our marketplace...
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
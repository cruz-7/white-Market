// cspell:ignore Jollof
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Upload, X, ImagePlus, Loader2 } from "lucide-react";

import { Button } from "./button";
import { Card, CardContent } from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Label } from "./label";
import { Badge } from "./badge";
import { productsApi } from "./api";

const CATEGORIES = [
  "Food",
  "Clothing",
  "Beauty",
  "Accessories",
  "Electronics",
  "Stationery",
  "Books",
  "Services",
  "Other",
];

function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    category: "Other",
    image_url: "",
  });

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to server
    setUploadingImage(true);
    productsApi.uploadImage(file).then((result) => {
      setUploadingImage(false);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.data?.image_url) {
        setForm((prev) => ({ ...prev, image_url: result.data.image_url }));
        toast.success("Image uploaded successfully");
      }
    });
  };

  const removeImage = () => {
    setImagePreview(null);
    setForm((prev) => ({ ...prev, image_url: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.title.trim()) {
      toast.error("Please enter a product title");
      return;
    }

    const price = Number.parseFloat(form.price);
    if (!price || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    setLoading(true);

    const result = await productsApi.create({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      price,
      image_url: form.image_url || undefined,
    });

    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Product listed successfully!");
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      {/* Header */}
      <div className="border-b bg-white/85 shadow-sm backdrop-blur-md">
        <div className="container py-3">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <div className="container py-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6">
            <Badge variant="outline" className="mb-2 bg-primary/5 text-primary border-primary/20">
              List a Product
            </Badge>
            <h1 className="text-2xl font-bold text-slate-900">Add New Product</h1>
            <p className="text-slate-600">
              Fill in the details below to list your product on White Market.
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Image Upload */}
                <div>
                  <Label className="text-slate-900">Product Image</Label>
                  <p className="text-xs text-slate-500 mb-2">
                    Add a clear photo to attract buyers
                  </p>
                  
                  {imagePreview || form.image_url ? (
                    <div className="relative inline-block">
                      <img
                        src={imagePreview || form.image_url}
                        alt="Product preview"
                        className="h-48 w-full max-w-sm rounded-lg object-cover border"
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        aria-label="Remove selected image"
                        title="Remove selected image"
                        className="absolute -top-2 -right-2 rounded-full bg-red-500 p-1.5 text-white hover:bg-red-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex h-40 w-full max-w-sm cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-primary hover:bg-primary/5">
                      {uploadingImage ? (
                        <>
                          <Loader2 className="h-8 w-8 animate-text-reveal text-primary" />
                          <span className="mt-2 text-sm text-slate-500">Uploading...</span>
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-8 w-8 text-slate-400" />
                          <span className="mt-2 text-sm text-slate-500">Click to upload image</span>
                          <span className="text-xs text-slate-400">PNG, JPG up to 5MB</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageChange}
                        disabled={uploadingImage}
                      />
                    </label>
                  )}
                </div>

                {/* Title */}
                <div>
                  <Label htmlFor="title" className="text-slate-900">
                    Product Title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g., Homemade Jollof Rice, AirPods Pro, Calculator"
                    className="mt-1.5"
                    maxLength={100}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {form.title.length}/100 characters
                  </p>
                </div>

                {/* Description */}
                <div>
                  <Label htmlFor="description" className="text-slate-900">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe your product, include details like size, condition, what's included..."
                    className="mt-1.5"
                    rows={4}
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {form.description.length}/500 characters
                  </p>
                </div>

                {/* Price and Category */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="price" className="text-slate-900">
                      Price (GHS) <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₵</span>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.price}
                        onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                        placeholder="0.00"
                        className="pl-7"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="category" className="text-slate-900">
                      Category <span className="text-red-500">*</span>
                    </Label>
                    <select
                      id="category"
                      aria-label="Product category"
                      title="Product category"
                      value={form.category}
                      onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                      className="mt-1.5 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tips */}
                <div className="rounded-lg bg-primary/5 p-4">
                  <h3 className="font-semibold text-slate-900 text-sm">Tips for a great listing:</h3>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    <li>• Use a clear, well-lit photo</li>
                    <li>• Include exact dimensions or sizes</li>
                    <li>• Mention condition (new, used, etc.)</li>
                    <li>• Set a competitive price</li>
                    <li>• Respond quickly to messages</li>
                  </ul>
                </div>

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/dashboard")}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={loading || !form.title.trim() || !form.price}
                    className="flex-1"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Listing Product...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        List Product
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default AddProduct;

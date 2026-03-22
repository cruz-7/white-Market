import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "./button";
import { Card, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";
import { Input } from "./input";
import { BookOpen, Search, Filter, Star, MapPin, ShoppingCart, Heart, User, ArrowLeft, GraduationCap, Book } from "lucide-react";
import { booksApi, BooksAndNotesItem } from "./api";

const CATEGORIES = [
  { value: "textbook", label: "Textbooks" },
  { value: "notebook", label: "Notebooks" },
  { value: "past_questions", label: "Past Questions" },
  { value: "guide", label: "Study Guides" },
  { value: "handout", label: "Handouts" },
  { value: "lecture_notes", label: "Lecture Notes" },
];

const CONDITIONS = [
  { value: "new", label: "Brand New", color: "bg-green-100 text-green-800" },
  { value: "like_new", label: "Like New", color: "bg-emerald-100 text-emerald-800" },
  { value: "good", label: "Good", color: "bg-yellow-100 text-yellow-800" },
  { value: "fair", label: "Fair", color: "bg-orange-100 text-orange-800" },
];

const LEVELS = ["100", "200", "300", "400"];

export default function BooksAndNotesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<BooksAndNotesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, selectedCondition, selectedLevel, sortBy]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const response = await booksApi.getAll(
        selectedCategory || undefined,
        undefined,
        undefined,
        selectedLevel || undefined,
        selectedCondition || undefined,
        undefined,
        undefined,
        search || undefined,
        20,
        0,
        sortBy
      );
      if (response.data) {
        setItems(response.data);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchItems();
  };

  const getConditionBadge = (condition: string) => {
    const cond = CONDITIONS.find(c => c.value === condition);
    return cond ? (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cond.color}`}>
        {cond.label}
      </span>
    ) : null;
  };

  return (
    <div className="min-h-screen bg-amber-50">
      <div className="bg-gradient-to-r from-amber-700 to-amber-600 text-white px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <BookOpen className="w-8 h-8" />
                Books & Notes
              </h1>
              <p className="text-amber-100">Find textbooks, notes, and study materials</p>
            </div>
          </div>
          <form onSubmit={handleSearch} className="mt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by title, author, course code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-0 text-slate-900"
                />
              </div>
              <Button type="submit" className="bg-amber-800">Search</Button>
            </div>
          </form>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={() => { setSelectedCategory(""); fetchItems(); }}
            className={`px-4 py-2 rounded-full text-sm font-medium ${!selectedCategory ? "bg-amber-600 text-white" : "bg-white border border-amber-200"}`}>
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => { setSelectedCategory(cat.value); fetchItems(); }}
              className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === cat.value ? "bg-amber-600 text-white" : "bg-white border border-amber-200"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <select value={selectedCondition} onChange={(e) => { setSelectedCondition(e.target.value); fetchItems(); }}
            className="px-4 py-2 rounded-lg border border-amber-200">
            <option value="">All Conditions</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={selectedLevel} onChange={(e) => { setSelectedLevel(e.target.value); fetchItems(); }}
            className="px-4 py-2 rounded-lg border border-amber-200">
            <option value="">All Levels</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </select>
          <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); fetchItems(); }}
            className="px-4 py-2 rounded-lg border border-amber-200">
            <option value="newest">Newest First</option>
            <option value="price_low">Price: Low to High</option>
            <option value="price_high">Price: High to Low</option>
            <option value="rating">Highest Rated</option>
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl h-72 animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen className="w-16 h-16 text-amber-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-900">No books found</h3>
            <p className="text-slate-500">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-lg border-amber-100">
                <div className="aspect-[3/4] bg-gradient-to-br from-amber-50 to-amber-100 relative">
                  {item.images && item.images[0] ? (
                    <img src={item.images[0]} alt={item.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Book className="w-16 h-16 text-amber-300" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">{getConditionBadge(item.condition)}</div>
                  {item.academic_level && (
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-slate-900/80 text-white">
                        <GraduationCap className="w-3 h-3 mr-1" />
                        {item.academic_level}
                      </Badge>
                    </div>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-slate-900 line-clamp-2 mb-1">{item.title}</h3>
                  {item.author && <p className="text-sm text-slate-500 mb-2">by {item.author}</p>}
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    {item.course_code && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">{item.course_code}</span>}
                    {item.subject && <span>{item.subject}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span className="text-sm font-medium">{item.rating || "0.0"}</span>
                    <span className="text-xs text-slate-400">({item.review_count || 0})</span>
                  </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex items-center justify-between">
                  <div>
                    <span className="text-lg font-bold text-amber-700">GHS {item.price}</span>
                    {item.price_negotiable && <span className="text-xs text-slate-400 block">Negotiable</span>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="border-amber-200">
                      <Heart className="w-4 h-4" />
                    </Button>
                    <Button size="sm" className="bg-amber-600" onClick={() => navigate(`/books/${item.id}`)}>
                      View
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

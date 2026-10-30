import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "./button";
import { Card, CardContent, CardFooter } from "./card";
import { Badge } from "./badge";
import { Input } from "./input";
import { BookOpen, Search, Filter, Star, MapPin, ShoppingCart, User, ArrowLeft, GraduationCap, Book } from "lucide-react";
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
  const { id } = useParams<{ id?: string }>();
  const [items, setItems] = useState<BooksAndNotesItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<BooksAndNotesItem | null>(null);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedLevel, setSelectedLevel] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await booksApi.getAll(
        selectedCategory || undefined,
        undefined,
        undefined,
        selectedLevel || undefined,
        selectedCondition || undefined,
        undefined,
        undefined,
        submittedSearch || undefined,
        20,
        0,
        sortBy
      );
      if (response.error) throw new Error(response.error);
      setItems(response.data ?? []);
    } catch (error) {
      console.error("Error fetching books:", error);
      setLoadError(error instanceof Error ? error.message : "Could not load books and notes.");
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedCondition, selectedLevel, sortBy, submittedSearch]);

  useEffect(() => {
    if (!id) void fetchItems();
  }, [id, fetchItems]);

  useEffect(() => {
    if (!id) {
      setSelectedBook(null);
      return;
    }

    let cancelled = false;
    setBookLoading(true);
    setBookError(null);
    void booksApi.getById(id).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        setBookError(error || "Book listing not found.");
      } else {
        setSelectedBook(data);
      }
      setBookLoading(false);
    });

    return () => { cancelled = true; };
  }, [id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedSearch(search.trim());
  };

  const getConditionBadge = (condition: string) => {
    const cond = CONDITIONS.find(c => c.value === condition);
    return cond ? (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cond.color}`}>
        {cond.label}
      </span>
    ) : null;
  };

  if (id) {
    if (bookLoading) {
      return <div className="flex min-h-[400px] items-center justify-center"><BookOpen className="h-8 w-8 animate-pulse text-amber-600" /></div>;
    }
    if (bookError || !selectedBook) {
      return (
        <div className="container mx-auto px-4 py-12 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Book listing unavailable</h1>
          <p className="mt-2 text-slate-500">{bookError || "This listing could not be found."}</p>
          <Button className="mt-5 bg-amber-600" onClick={() => navigate("/books-and-notes")}>Back to Books & Notes</Button>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-amber-50">
        <div className="mx-auto max-w-5xl px-4 py-8">
          <Button variant="outline" className="mb-6 border-amber-200" onClick={() => navigate("/books-and-notes")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Books & Notes
          </Button>
          <Card className="overflow-hidden border-amber-100">
            <div className="grid md:grid-cols-2">
              <div className="flex min-h-80 items-center justify-center bg-gradient-to-br from-amber-50 to-amber-100">
                {selectedBook.images?.[0] ? (
                  <img src={selectedBook.images[0]} alt={selectedBook.title} className="h-full max-h-[32rem] w-full object-cover" />
                ) : <Book className="h-24 w-24 text-amber-300" />}
              </div>
              <CardContent className="space-y-4 p-6 md:p-8">
                <Badge className="bg-amber-100 text-amber-800">{selectedBook.book_type.replace(/_/g, " ")}</Badge>
                <h1 className="text-2xl font-bold text-slate-900">{selectedBook.title}</h1>
                {selectedBook.author && <p className="text-slate-600">by {selectedBook.author}</p>}
                <p className="text-2xl font-bold text-amber-700">GHS {selectedBook.price.toFixed(2)}</p>
                {selectedBook.description && <p className="whitespace-pre-wrap text-slate-600">{selectedBook.description}</p>}
                <div className="space-y-1 text-sm text-slate-600">
                  {selectedBook.course_code && <p>Course code: {selectedBook.course_code}</p>}
                  {selectedBook.subject && <p>Subject: {selectedBook.subject}</p>}
                  {selectedBook.academic_level && <p>Academic level: {selectedBook.academic_level}</p>}
                  <p>Condition: {selectedBook.condition.replace(/_/g, " ")}</p>
                  {selectedBook.location && <p>Location: {selectedBook.location}</p>}
                  <p>{selectedBook.rating.toFixed(1)} rating ({selectedBook.review_count} reviews)</p>
                </div>
                <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => navigate(`/seller/${selectedBook.user_id}`)}>
                  View seller profile
                </Button>
              </CardContent>
            </div>
          </Card>
        </div>
      </div>
    );
  }

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
          <button onClick={() => setSelectedCategory("")}
            className={`px-4 py-2 rounded-full text-sm font-medium ${!selectedCategory ? "bg-amber-600 text-white" : "bg-white border border-amber-200"}`}>
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${selectedCategory === cat.value ? "bg-amber-600 text-white" : "bg-white border border-amber-200"}`}>
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value)}
            className="px-4 py-2 rounded-lg border border-amber-200">
            <option value="">All Conditions</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}
            className="px-4 py-2 rounded-lg border border-amber-200">
            <option value="">All Levels</option>
            {LEVELS.map((l) => <option key={l} value={l}>{l} Level</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
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
        ) : loadError ? (
          <div className="py-12 text-center" role="alert">
            <p className="text-red-700">{loadError}</p>
            <Button className="mt-4 bg-amber-600" onClick={() => void fetchItems()}>Retry</Button>
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
                    <Button size="sm" className="bg-amber-600" onClick={() => navigate(`/books-and-notes/${item.id}`)}>
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

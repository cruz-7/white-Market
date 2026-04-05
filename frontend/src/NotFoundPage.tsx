import { useNavigate } from "react-router-dom";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Home, ArrowLeft, Search } from "lucide-react";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="text-6xl mb-4">🔍</div>
          <CardTitle className="text-2xl">Page Not Found</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate("/")} className="w-full">
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/marketplace")}
              className="w-full"
            >
              <Search className="w-4 h-4 mr-2" />
              Browse Marketplace
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t bg-white">
    <div className="container py-8 px-4">
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-4 lg:gap-8">
        {/* Brand Column */}
        <div className="col-span-2 sm:col-span-2 md:col-span-1">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="font-display text-sm font-bold text-primary-foreground">WM</span>
            </div>
            <span className="font-display text-lg font-bold">White Market</span>
          </div>
          <p className="text-sm text-muted-foreground">
            The trusted marketplace for University of Ghana students.
          </p>
        </div>
        
        {/* Platform Column */}
        <div>
          <h4 className="mb-3 font-display font-semibold text-foreground">Platform</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/marketplace" className="text-muted-foreground hover:text-foreground transition-colors">
                Browse Products
              </Link>
            </li>
            <li>
              <Link to="/auth?tab=signup" className="text-muted-foreground hover:text-foreground transition-colors">
                Start Selling
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                My Dashboard
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Support Column */}
        <div>
          <h4 className="mb-3 font-display font-semibold text-foreground">Support</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                Help Center
              </Link>
            </li>
            <li>
              <Link to="/safety" className="text-muted-foreground hover:text-foreground transition-colors">
                Safety Tips
              </Link>
            </li>
            <li>
              <Link to="/report" className="text-muted-foreground hover:text-foreground transition-colors">
                Report an Issue
              </Link>
            </li>
          </ul>
        </div>
        
        {/* Trust & Legal Column */}
        <div>
          <h4 className="mb-3 font-display font-semibold text-foreground">Trust & Legal</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/buyer-protection" className="text-muted-foreground hover:text-foreground transition-colors">
                Buyer Protection
              </Link>
            </li>
          </ul>
        </div>
      </div>
      
      {/* Bottom Copyright */}
      <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} White Market. Built for Legon, by Legon.
      </div>
    </div>
  </footer>
);

export default Footer;

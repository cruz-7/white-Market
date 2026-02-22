import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="border-t bg-white">
    <div className="container py-12">
      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
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
        <div>
          <h4 className="mb-3 font-display font-semibold">Platform</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link to="/marketplace" className="transition-colors hover:text-foreground">Browse Products</Link></li>
            <li><Link to="/auth?tab=signup" className="transition-colors hover:text-foreground">Start Selling</Link></li>
            <li><Link to="/dashboard" className="transition-colors hover:text-foreground">My Dashboard</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display font-semibold">Support</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Help Center</span></li>
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Safety Tips</span></li>
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Report an Issue</span></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 font-display font-semibold">Trust & Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Terms of Service</span></li>
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Privacy Policy</span></li>
            <li><span className="cursor-pointer transition-colors hover:text-foreground">Buyer Protection</span></li>
          </ul>
        </div>
      </div>
      <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} White Market. Built for Legon, by Legon.
      </div>
    </div>
  </footer>
);

export default Footer;

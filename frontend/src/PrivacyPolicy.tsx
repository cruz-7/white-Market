import { Shield, Lock, Eye, Database, Mail, User, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  
  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto max-w-4xl py-8 px-4">
          <button 
            onClick={() => navigate(-1)} 
            className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </button>
          
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-6 w-6 text-teal-600" />
            <h1 className="text-2xl font-bold">Privacy Policy</h1>
          </div>
          
          <div className="bg-slate-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-600">Last Updated: February 2025</p>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Database className="h-5 w-5 text-teal-600" />
                1. Information We Collect
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We collect information to provide better services to all our users:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Name, email address, phone number, and profile picture when you create an account.</li>
                  <li><strong>Profile Information:</strong> For service providers - skills, pricing, availability, and payment details including Mobile Money number.</li>
                  <li><strong>Verification Documents:</strong> Student ID uploads for UG student verification stored securely.</li>
                  <li><strong>Transaction Data:</strong> Order history, payment records, and earnings data.</li>
                  <li><strong>Communications:</strong> Messages between buyers and sellers, customer support inquiries.</li>
                  <li><strong>Usage Data:</strong> How you interact with our platform.</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Eye className="h-5 w-5 text-teal-600" />
                2. How We Use Information
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We use the information we collect to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide, maintain, and improve our services</li>
                  <li>Verify student identity through UG email and student ID</li>
                  <li>Process transactions and facilitate payments via Mobile Money</li>
                  <li>Connect buyers with service providers</li>
                  <li>Send you technical notices, updates, and support messages</li>
                  <li>Respond to your comments, questions, and provide customer service</li>
                  <li>Detect, investigate, and prevent fraudulent transactions</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Lock className="h-5 w-5 text-teal-600" />
                3. Information Sharing & Disclosure
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We may share your information in the following circumstances:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>With Service Providers:</strong> Vendors who help us operate our platform</li>
                  <li><strong>For Legal Reasons:</strong> When required by law or to protect rights and safety</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger or sale</li>
                  <li><strong>With Your Consent:</strong> When you explicitly agree</li>
                </ul>
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mt-4">
                  <p className="text-sm text-amber-800"><strong>Note:</strong> We never sell your personal information to third parties for marketing purposes.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <User className="h-5 w-5 text-teal-600" />
                4. Your Rights
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>As a user of White Market, you have the following rights:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                  <li><strong>Deletion:</strong> Request deletion of your data</li>
                  <li><strong>Data Portability:</strong> Request data in machine-readable format</li>
                  <li><strong>Opt-Out:</strong> Opt out of marketing communications</li>
                </ul>
                <p className="mt-4">Contact: <strong>support@whitemarket.com</strong></p>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-teal-600" />
                5. Data Security
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>We implement appropriate security measures:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Encryption of data in transit and at rest</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls limiting employee access</li>
                  <li>Secure storage with Supabase (SOC 2 Type II certified)</li>
                  <li>Two-factor authentication for admin accounts</li>
                </ul>
                <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-4">
                  <p className="text-sm text-green-800"><strong>Security Tip:</strong> Use a strong, unique password and never share your login credentials.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">6. Data Retention</h2>
              <div className="space-y-4 text-slate-600">
                <p>We retain personal data only as long as necessary:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Data:</strong> While active, plus 2 years after closure</li>
                  <li><strong>Transaction Records:</strong> 7 years for legal and tax purposes</li>
                  <li><strong>Verification Documents:</strong> Duration of account activity</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">7. Third-Party Services</h2>
              <div className="space-y-4 text-slate-600">
                <p>Our platform uses trusted third-party services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Supabase:</strong> Database and authentication</li>
                  <li><strong>Paystack:</strong> Mobile Money payment processing</li>
                  <li><strong>Vercel:</strong> Hosting and content delivery</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">8. Contact Us</h2>
              <div className="space-y-4 text-slate-600">
                <p>Questions about this Privacy Policy:</p>
                <div className="bg-slate-100 p-4 rounded-lg">
                  <p><strong>White Market Privacy Team</strong></p>
                  <p>University of Ghana, Legon</p>
                  <p>Accra, Ghana</p>
                  <p>Email: support@whitemarket.com</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t">
            <button onClick={() => navigate("/")} className="inline-flex items-center gap-2 text-teal-600 hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </button>
          </div>
        </main>
        <Footer />
        <MobileBottomNav />
      </div>
    </>
  );
}

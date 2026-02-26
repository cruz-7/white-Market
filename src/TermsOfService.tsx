import { FileText, Shield, Users, CreditCard, AlertTriangle, Gavel, ChevronRight, Star } from "lucide-react";
import { Link } from "react-router-dom";
import Navbar from "./Navbar";
import Footer from "./Footer";
import MobileBottomNav from "./MobileBottomNav";

export default function TermsOfService() {
  return (
    <>
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <main className="container mx-auto max-w-4xl py-8 px-4">
          <div className="flex items-center gap-2 mb-6">
            <FileText className="h-6 w-6 text-teal-600" />
            <h1 className="text-2xl font-bold">Terms of Service</h1>
          </div>
          
          <div className="bg-slate-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-slate-600">Last Updated: February 2025</p>
          </div>

          <div className="space-y-6">
            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-teal-600" />
                1. Acceptance of Terms
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>Welcome to UG Hustle. By accessing and using our platform, you accept and agree to be bound by the terms and provision of this agreement:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>You must be a University of Ghana student or authorized user</li>
                  <li>You agree to provide accurate and complete information</li>
                  <li>You agree to maintain the security of your account</li>
                  <li>You agree to comply with all applicable laws and regulations</li>
                  <li>You agree to respect the rights and privacy of other users</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-teal-600" />
                2. UG Hustle for Students
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>UG Hustle is an exclusive platform for University of Ghana students to offer and hire services:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Verification:</strong> All service providers must verify their UG student status</li>
                  <li><strong>UG Email Required:</strong> Registration requires a valid ug.edu.gh email address</li>
                  <li><strong>Student ID:</strong> May be required for verification purposes</li>
                  <li><strong>Trust & Safety:</strong> Verified badges indicate confirmed UG students</li>
                </ul>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mt-4">
                  <p className="text-sm text-blue-800"><strong>Why UG Only:</strong> This platform is designed to create a trusted community of UG students. Only verified students can offer services.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-teal-600" />
                3. Service Provider Obligations
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>As a service provider on UG Hustle, you agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate descriptions of your services</li>
                  <li>Deliver services as promised or agreed upon</li>
                  <li>Respond to inquiries within a reasonable timeframe</li>
                  <li>Maintain professional conduct in all communications</li>
                  <li>Set fair and reasonable prices</li>
                  <li>Honored agreed delivery times</li>
                  <li>Not engage in any fraudulent or deceptive practices</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Users className="h-5 w-5 text-teal-600" />
                4. Buyer Responsibilities
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>As a buyer using UG Hustle services, you agree to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Provide accurate information when requesting services</li>
                  <li>Make timely payments for services rendered</li>
                  <li>Communicate respectfully with service providers</li>
                  <li>Not request services that violate laws or regulations</li>
                  <li>Provide necessary materials or information for service delivery</li>
                  <li>Release payment promptly when service is completed satisfactorily</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-teal-600" />
                5. Payments & Financial Terms
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>UG Hustle uses Mobile Money for all transactions:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Payment Method:</strong> All payments are processed via Mobile Money (MTN, Vodafone, AirtelTigo)</li>
                  <li><strong>Escrow System:</strong> Payments are held until service is completed</li>
                  <li><strong>Platform Fee:</strong> A small service fee may be charged on transactions</li>
                  <li><strong>Payout Schedule:</strong> Earnings are paid out weekly or upon request</li>
                  <li><strong>Refunds:</strong> Available only if service is not delivered as agreed</li>
                </ul>
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mt-4">
                  <p className="text-sm text-amber-800"><strong>Important:</strong> Never make payments outside of UG Hustle's platform. Doing so violates our terms and may result in loss of funds.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-teal-600" />
                6. Prohibited Activities
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>The following activities are strictly prohibited on UG Hustle:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Sharing account credentials with others</li>
                  <li>Creating multiple accounts to evade restrictions</li>
                  <li>Posting false or misleading service descriptions</li>
                  <li>Engaging in harassment or discriminatory behavior</li>
                  <li>Offering illegal services or violating University policies</li>
                  <li>Attempting to bypass platform payment systems</li>
                  <li>Spamming or sending unsolicited messages</li>
                  <li>Using the platform for commercial purposes outside scope</li>
                </ul>
                <div className="bg-red-50 border-l-4 border-red-500 p-4 mt-4">
                  <p className="text-sm text-red-800"><strong>Violation Consequences:</strong> Users found violating these terms may have their accounts suspended or terminated without notice.</p>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                <Gavel className="h-5 w-5 text-teal-600" />
                7. Disputes & Resolution
              </h2>
              <div className="space-y-4 text-slate-600">
                <p>In case of disputes between buyers and sellers:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Step 1:</strong> Contact the other party directly to resolve</li>
                  <li><strong>Step 2:</strong> If unresolved, open a dispute within 7 days</li>
                  <li><strong>Step 3:</strong> UG Hustle admin will review evidence</li>
                  <li><strong>Step 4:</strong> Decision will be made based on available evidence</li>
                </ul>
                <p className="mt-4">UG Hustle reserves the right to:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Mediate disputes and make final decisions</li>
                  <li>Refund payments in case of fraud or non-delivery</li>
                  <li>Suspend accounts during dispute investigation</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">8. Ratings & Reviews</h2>
              <div className="space-y-4 text-slate-600">
                <p>Our rating system helps maintain trust:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Buyers can rate sellers after service completion</li>
                  <li>Honest reviews help the community</li>
                  <li>False or retaliatory reviews are prohibited</li>
                  <li>Low ratings may result in account review</li>
                  <li>Users with consistently poor ratings may be suspended</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">9. Intellectual Property</h2>
              <div className="space-y-4 text-slate-600">
                <p>Content and materials on UG Hustle:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Your Content:</strong> You retain ownership of content you post</li>
                  <li><strong>Platform Content:</strong> UG Hustle logos and branding are proprietary</li>
                  <li><strong>License:</strong> You grant UG Hustle license to use your content for the platform</li>
                  <li><strong>Copyright:</strong> Respect copyright when posting others' content</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">10. Limitation of Liability</h2>
              <div className="space-y-4 text-slate-600">
                <p>UG Hustle provides the platform "as is":</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We are not responsible for service quality between users</li>
                  <li>We do not guarantee uninterrupted platform availability</li>
                  <li>Users are responsible for verifying other users' identities</li>
                  <li>We are not liable for any financial losses due to user disputes</li>
                  <li>Maximum liability is limited to the amount you paid to UG Hustle</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">11. Termination</h2>
              <div className="space-y-4 text-slate-600">
                <p>Account termination may occur for:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Violation of these terms of service</li>
                  <li>Fraudulent or illegal activity</li>
                  <li>Extended period of inactivity</li>
                  <li>Request by user (contact support)</li>
                </ul>
                <p className="mt-4">Upon termination:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Access to account will be revoked</li>
                  <li>Pending transactions will be handled appropriately</li>
                  <li>Data may be retained as required by law</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">12. Changes to Terms</h2>
              <div className="space-y-4 text-slate-600">
                <p>We may modify these terms from time to time:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Material changes will be notified via email</li>
                  <li>Continued use constitutes acceptance of new terms</li>
                  <li>Previous versions will be archived</li>
                  <li>Questions about changes can be directed to support</li>
                </ul>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">13. Governing Law</h2>
              <div className="space-y-4 text-slate-600">
                <p>These terms are governed by:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>Laws of Ghana</li>
                  <li>University of Ghana policies</li>
                  <li>Any applicable consumer protection regulations</li>
                </ul>
                <p className="mt-4">Any legal disputes will be resolved in Ghanaian courts.</p>
              </div>
            </section>

            <section className="bg-white rounded-lg shadow-sm p-6 border">
              <h2 className="text-xl font-semibold mb-4">14. Contact Information</h2>
              <div className="space-y-4 text-slate-600">
                <p>For questions about these Terms of Service:</p>
                <div className="bg-slate-100 p-4 rounded-lg">
                  <p><strong>UG Hustle Support Team</strong></p>
                  <p>University of Ghana, Legon</p>
                  <p>Accra, Ghana</p>
                  <p>Email: support@ughustle.com</p>
                  <p>Phone: +233 20 000 0000</p>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t">
            <Link to="/" className="inline-flex items-center text-teal-600 hover:underline">
              <ChevronRight className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </div>
        </main>
        <Footer />
        <MobileBottomNav />
      </div>
    </>
  );
}

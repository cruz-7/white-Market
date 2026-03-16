import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock3, 
  ShieldCheck, 
  Upload, 
  AlertCircle,
  Loader2 
} from "lucide-react";

import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./card";
import { verificationApi, type VerificationStatus } from "./api";

function VerifyStudent() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);
  const [documentType, setDocumentType] = useState<"student_id" | "admission_letter">("student_id");

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    const result = await verificationApi.getStatus();
    setLoading(false);
    
    if (result.error) {
      toast.error(result.error);
      return;
    }
    
    if (result.data) {
      setStatus(result.data);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    const result = await verificationApi.submitRequest({ document_type: documentType });
    setSubmitting(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(result.data?.message || "Verification request submitted!");
    fetchStatus();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="mt-2 text-slate-600">Loading verification status...</p>
        </div>
      </div>
    );
  }

  // Show verified status
  if (status?.verified || status?.verification_status === "approved") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
        <div className="container py-8 max-w-xl mx-auto">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-4"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>

          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h2 className="mt-4 text-2xl font-bold text-green-800">Verified UG Student</h2>
              <p className="mt-2 text-green-700">
                Your student status has been verified. You now have a trusted seller badge!
              </p>
              {status.is_school_email && (
                <p className="mt-2 text-sm text-green-600">
                  Verified automatically via your school email address.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show pending status
  if (status?.verification_status === "pending") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
        <div className="container py-8 max-w-xl mx-auto">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-4"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="pt-6 text-center">
              <Clock3 className="h-16 w-16 text-amber-500 mx-auto" />
              <h2 className="mt-4 text-2xl font-bold text-amber-800">Verification Pending</h2>
              <p className="mt-2 text-amber-700">
                Your verification request is under review. This usually takes 24-48 hours.
              </p>
              <p className="mt-4 text-sm text-amber-600">
                You'll receive a notification once your verification is approved.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show rejected status
  if (status?.verification_status === "rejected") {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
        <div className="container py-8 max-w-xl mx-auto">
          <button 
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-4"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
              <h2 className="mt-4 text-2xl font-bold text-red-800">Verification Rejected</h2>
              <p className="mt-2 text-red-700">
                Your verification was not approved. Please try again with a clearer document.
              </p>
              <Button className="mt-4" onClick={fetchStatus}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show verification form (none status)
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <div className="container py-8 max-w-xl mx-auto">
        <button 
          className="inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1.5 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800 mb-4"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </button>

        <Card>
          <CardHeader className="text-center">
            <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-2" />
            <CardTitle className="text-2xl">Verify Your Student Status</CardTitle>
            <CardDescription>
              Get a verified badge to increase buyer trust and visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Benefits */}
            <div className="rounded-lg bg-green-50 p-4">
              <h3 className="font-semibold text-green-800 mb-2">Why verify?</h3>
              <ul className="text-sm text-green-700 space-y-1">
                <li>✓ Trusted seller badge on your profile</li>
                <li>✓ Higher visibility in search results</li>
                <li>✓ More buyer confidence in purchases</li>
                <li>✓ Access to seller analytics</li>
              </ul>
            </div>

            {/* Document Type Selection */}
            <div className="space-y-3">
              <label className="text-sm font-semibold text-slate-900">
                Select document type to upload:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label 
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition ${
                    documentType === "student_id" 
                      ? "border-primary bg-primary/5" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="documentType" 
                    value="student_id"
                    checked={documentType === "student_id"}
                    onChange={() => setDocumentType("student_id")}
                    className="sr-only"
                  />
                  <span className="font-medium">Student ID Card</span>
                  <span className="text-xs text-slate-500 mt-1">UG Legon card</span>
                </label>
                <label 
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition ${
                    documentType === "admission_letter" 
                      ? "border-primary bg-primary/5" 
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input 
                    type="radio" 
                    name="documentType" 
                    value="admission_letter"
                    checked={documentType === "admission_letter"}
                    onChange={() => setDocumentType("admission_letter")}
                    className="sr-only"
                  />
                  <span className="font-medium">Admission Letter</span>
                  <span className="text-xs text-slate-500 mt-1">Acceptance letter</span>
                </label>
              </div>
            </div>

            {/* Upload Button */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-lg p-6">
              <Upload className="h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm text-slate-600">
                Upload a clear photo of your {documentType === "student_id" ? "Student ID" : "Admission Letter"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supported formats: JPG, PNG (max 5MB)
              </p>
            </div>

            {/* Submit Button */}
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Submit for Review
                </>
              )}
            </Button>

            {/* Info */}
            <p className="text-xs text-center text-slate-500">
              By submitting, you agree to verify your student status. 
              Your document will be reviewed by our admin team within 24-48 hours.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VerifyStudent;

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, AlertTriangle, MessageSquare, Shield, CheckCircle, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { feedbackApi } from "./api";

export default function ReportIssue() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    reportType: "",
    email: "",
    description: "",
    orderId: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleScreenshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Screenshot must be 5 MB or smaller.");
      return;
    }
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleQuickReport = (type: string) => {
    setFormData(prev => ({ ...prev, reportType: type }));
    toast.info(`Selected ${type} report type. Please fill in the details below.`);
    document.getElementById("report-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.reportType) {
      toast.error("Please select a report type");
      return;
    }
    if (!formData.email) {
      toast.error("Please provide your email");
      return;
    }
    if (!formData.description) {
      toast.error("Please provide a description of the issue");
      return;
    }

    setIsSubmitting(true);
    try {
      let reportImageUrls: string[] | undefined;
      if (selectedFile) {
        const upload = await feedbackApi.uploadReportScreenshot(selectedFile);
        if (upload.error || !upload.data?.image_url) {
          throw new Error(upload.error || "Screenshot upload failed.");
        }
        reportImageUrls = [upload.data.image_url];
      }
      const { error } = await feedbackApi.submitFeedback({
        feedback_type: `issue_report_${formData.reportType}`,
        feedback_text: [
          `Report type: ${formData.reportType}`,
          `Related order/user: ${formData.orderId.trim() || "Not provided"}`,
          "",
          formData.description.trim(),
        ].join("\n"),
        reporter_email: formData.email.trim(),
        report_image_urls: reportImageUrls,
        page_url: window.location.href,
      });
      if (error) throw new Error(error);
      setSubmitted(true);
      toast.success("Report submitted successfully. The admin team can review it in Feedback.");
    } catch (error) {
      console.error("Failed to submit issue report:", error);
      toast.error(error instanceof Error ? error.message : "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({ reportType: "", email: "", description: "", orderId: "" });
    setSelectedFile(null);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
        <div className="container py-8">
          <button 
            onClick={() => navigate(-1)} 
            className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" /> Back to previous page
          </button>
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Report Submitted!</h1>
            <p className="mt-3 text-lg text-slate-600">
              Thank you for helping keep White Market safe. Your report is now available to the admin team for review.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button onClick={handleReset} variant="outline">Submit Another Report</Button>
              <Button asChild><Link to="/">Return to Home</Link></Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <div className="container py-8">
        <button 
          onClick={() => navigate(-1)} 
          className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Back to previous page
        </button>
        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Report an Issue</h1>
            <p className="mt-2 text-lg text-slate-600">Help us keep White Market safe for everyone</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-5 w-5" />
                  Safety Concerns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">Report suspicious users, harassment, or safety threats.</p>
                <Button className="w-full" variant="destructive" onClick={() => handleQuickReport("safety")}>Report Safety Issue</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <MessageSquare className="h-5 w-5" />
                  Platform Issues
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">Report bugs, payment problems, or technical difficulties.</p>
                <Button className="w-full" variant="outline" onClick={() => handleQuickReport("bug")}>Report Bug</Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Shield className="h-5 w-5" />
                  Policy Violations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">Report prohibited items, spam, or terms of service violations.</p>
                <Button className="w-full" variant="outline" onClick={() => handleQuickReport("violation")}>Report Violation</Button>
              </CardContent>
            </Card>
          </div>
          <Card id="report-form">
            <CardHeader>
              <CardTitle>Submit a Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Report Type *</label>
                  <select 
                    name="reportType"
                    value={formData.reportType}
                    onChange={handleInputChange}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    title="Select report type"
                  >
                    <option value="">Select report type</option>
                    <option value="safety">Safety Concern</option>
                    <option value="bug">Technical Issue</option>
                    <option value="violation">Policy Violation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Your Email *</label>
                  <Input
                    name="email"
                    type="email"
                    placeholder="your.email@st.ug.edu.gh"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full"
                    title="Enter your email address"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Description *</label>
                <Textarea
                  name="description"
                  placeholder="Please provide as much detail as possible about the issue..."
                  value={formData.description}
                  onChange={handleInputChange}
                  className="min-h-32"
                  title="Describe the issue"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Related Order/User ID (if applicable)</label>
                <Input
                  name="orderId"
                  placeholder="Order #12345 or User ID"
                  value={formData.orderId}
                  onChange={handleInputChange}
                  className="w-full"
                  title="Enter order or user ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Screenshot (optional)</label>
                {selectedFile ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
                    <Upload className="h-4 w-4 text-green-700" />
                    <span className="flex-1 truncate text-sm text-green-800">{selectedFile.name}</span>
                    <button type="button" onClick={() => setSelectedFile(null)} aria-label="Remove screenshot">
                      <X className="h-4 w-4 text-green-700" />
                    </button>
                  </div>
                ) : (
                  <Input type="file" accept="image/*" onChange={handleScreenshot} title="Attach a screenshot" />
                )}
                <p className="mt-1 text-xs text-slate-500">Up to 5 MB. Uploading requires sign-in; the report itself can still be submitted without an image.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button onClick={handleSubmitReport} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Emergency Safety Concern?</h3>
              <p className="text-slate-600 mb-4">
                If you are in immediate danger, this form is not monitored 24/7. Contact your campus security or local emergency services.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline" asChild><Link to="/buyer-protection">View Safety Tips</Link></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

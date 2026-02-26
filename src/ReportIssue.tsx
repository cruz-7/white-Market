import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle, MessageSquare, Shield } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Textarea } from "./textarea";

export default function ReportIssue() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eef7f1,_#f5f5f5_45%)]">
      <div className="container py-8">
        <button className="mb-6 inline-flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 text-sm text-slate-500 transition hover:border-slate-200 hover:bg-white hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </button>

        <div className="mx-auto max-w-4xl space-y-8">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Report an Issue</h1>
            <p className="mt-2 text-lg text-slate-600">
              Help us keep White Market safe for everyone
            </p>
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
                <p className="text-sm text-slate-600 mb-4">
                  Report suspicious users, harassment, or safety threats.
                </p>
                <Button className="w-full" variant="destructive">
                  Report Safety Issue
                </Button>
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
                <p className="text-sm text-slate-600 mb-4">
                  Report bugs, payment problems, or technical difficulties.
                </p>
                <Button className="w-full" variant="outline">
                  Report Bug
                </Button>
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
                <p className="text-sm text-slate-600 mb-4">
                  Report prohibited items, spam, or terms of service violations.
                </p>
                <Button className="w-full" variant="outline">
                  Report Violation
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Submit a Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Report Type
                  </label>
                  <select className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Select report type</option>
                    <option value="safety">Safety Concern</option>
                    <option value="bug">Technical Issue</option>
                    <option value="violation">Policy Violation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Your Email
                  </label>
                  <Input
                    type="email"
                    placeholder="your.email@st.ug.edu.gh"
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Description
                </label>
                <Textarea
                  placeholder="Please provide as much detail as possible about the issue..."
                  className="min-h-32"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Related Order/User ID (if applicable)
                </label>
                <Input
                  placeholder="Order #12345 or User ID"
                  className="w-full"
                />
              </div>

              <div className="flex items-center gap-4">
                <Button>Submit Report</Button>
                <Button variant="outline">Attach Screenshot</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Emergency Safety Concern?
              </h3>
              <p className="text-slate-600 mb-4">
                For immediate threats to personal safety, contact campus security directly.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button variant="outline">
                  Call Campus Security
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/safety">View Safety Tips</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

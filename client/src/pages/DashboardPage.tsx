import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { CrewDashboardSummary } from "@shared/schema";

export const DashboardPage = () => {
  // For now, show dashboard for a sample crew member
  const sampleCrewId = "2025-05-14"; // James Michael from the test data

  // Dashboard data query
  const { data: dashboardData, isLoading: isDashboardLoading, error: dashboardError } = useQuery<CrewDashboardSummary>({
    queryKey: [`/api/crew-members/${sampleCrewId}/dashboard`],
    enabled: true,
  });

  // Data mappings with proper nullish coalescing
  const statusData = dashboardData?.status;
  const experienceData = dashboardData?.experience;

  // Loading state
  if (isDashboardLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="dashboard-loading">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-sm text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  // Error state
  if (dashboardError) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" data-testid="dashboard-error">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error loading dashboard</p>
          <p className="text-sm text-gray-500 mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen" data-testid="dashboard-page">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-gray-900" data-testid="dashboard-title">
          Dashboard Overview
        </h1>
        <p className="text-gray-600" data-testid="dashboard-subtitle">
          Comprehensive crew member dashboard and analytics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Overview */}
        <Card data-testid="card-status-overview">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Status Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-orange-500 text-white p-3 rounded text-center" data-testid="status-onboard">
              <div className="text-sm" data-testid="text-status-value">{statusData?.status ?? 'On Board'}</div>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between" data-testid="info-vessel">
                <span className="text-gray-600">Vessel:</span>
                <span className="font-medium" data-testid="text-vessel-name">{statusData?.vessel ?? 'Pacific Explorer'}</span>
              </div>
              <div className="flex justify-between" data-testid="info-joined">
                <span className="text-gray-600">Joined:</span>
                <span data-testid="text-join-date">{statusData?.joinedDate ?? '15 Mar 2022'}</span>
              </div>
              <div className="flex justify-between" data-testid="info-sailing-due">
                <span className="text-gray-600">Sailing Due:</span>
                <span data-testid="text-sailing-due">{statusData?.sailingDue ?? '15 Jul 2022'}</span>
              </div>
              <div className="flex justify-between" data-testid="info-assignment">
                <span className="text-gray-600">Present Assignment:</span>
                <span data-testid="text-assignment">{statusData?.presentAssignment ?? 'Chandigarh'}</span>
              </div>
              <div className="text-xs text-gray-500 mt-3" data-testid="emergency-contact">
                <div>Emergency Contact Name, Relation, Ph:</div>
                <div className="text-red-600" data-testid="text-emergency-contact">
                  {statusData?.emergencyContact ? 
                    `${statusData.emergencyContact.name}, ${statusData.emergencyContact.relation}, ${statusData.emergencyContact.phone}` :
                    'Mira Kumari, Wife, +91 987 555 8553'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Experience Metrics */}
        <Card data-testid="card-experience-metrics">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Experience Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="space-y-1" data-testid="metric-company">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Company</span>
                  <span className="font-medium" data-testid="text-company-years">{(experienceData?.company ?? 1.2).toFixed(1)} years</span>
                </div>
                <Progress value={(experienceData?.company ?? 1.2) * 10} className="h-2" data-testid="progress-company" />
              </div>
              
              <div className="space-y-1" data-testid="metric-rank">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Rank</span>
                  <span className="font-medium" data-testid="text-rank-years">{(experienceData?.rank ?? 2.8).toFixed(1)} years</span>
                </div>
                <Progress value={(experienceData?.rank ?? 2.8) * 10} className="h-2" data-testid="progress-rank" />
              </div>
              
              <div className="space-y-1" data-testid="metric-tankers">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tankers</span>
                  <span className="font-medium" data-testid="text-tankers-years">{(experienceData?.tankers ?? 4.5).toFixed(1)} years</span>
                </div>
                <Progress value={(experienceData?.tankers ?? 4.5) * 10} className="h-2" data-testid="progress-tankers" />
              </div>
              
              <div className="space-y-1" data-testid="metric-ocw">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">OCW</span>
                  <span className="font-medium" data-testid="text-ocw-years">{(experienceData?.ocw ?? 3.1).toFixed(1)} years</span>
                </div>
                <Progress value={(experienceData?.ocw ?? 3.1) * 10} className="h-2" data-testid="progress-ocw" />
              </div>
              
              <div className="space-y-1" data-testid="metric-endorsements">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Endorsements</span>
                  <span className="font-medium" data-testid="text-endorsements-count">{experienceData?.endorsements ?? 5}</span>
                </div>
                <Progress value={(experienceData?.endorsements ?? 5) * 20} className="h-2" data-testid="progress-endorsements" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ship Type Experience */}
        <Card data-testid="card-ship-experience">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Ship Type Experience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2" data-testid="ship-type-oil-chemical">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Oil / Chemical Tanker</span>
                <span className="font-medium" data-testid="text-oil-chemical-years">4.2 years</span>
              </div>
              <Progress value={84} className="h-2" data-testid="progress-oil-chemical" />
            </div>
            
            <div className="space-y-2" data-testid="ship-type-lng">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">LNG Tanker</span>
                <span className="font-medium" data-testid="text-lng-years">1.8 years</span>
              </div>
              <Progress value={36} className="h-2" data-testid="progress-lng" />
            </div>
            
            <div className="space-y-2" data-testid="ship-type-container">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Container</span>
                <span className="font-medium" data-testid="text-container-years">2.1 years</span>
              </div>
              <Progress value={42} className="h-2" data-testid="progress-container" />
            </div>
            
            <div className="space-y-2" data-testid="ship-type-bulk">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bulk Carrier</span>
                <span className="font-medium" data-testid="text-bulk-years">0.9 years</span>
              </div>
              <Progress value={18} className="h-2" data-testid="progress-bulk" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Dashboard Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compliance Status */}
        <Card data-testid="card-compliance">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Compliance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1" data-testid="compliance-stcw">
                <Badge variant="default" className="w-full justify-center bg-green-500" data-testid="badge-stcw">STCW</Badge>
                <div className="text-xs text-center text-gray-500" data-testid="text-stcw-date">Valid until 2025</div>
              </div>
              <div className="space-y-1" data-testid="compliance-medical">
                <Badge variant="default" className="w-full justify-center bg-yellow-500" data-testid="badge-medical">Medical</Badge>
                <div className="text-xs text-center text-gray-500" data-testid="text-medical-date">Expires in 3 months</div>
              </div>
              <div className="space-y-1" data-testid="compliance-passport">
                <Badge variant="default" className="w-full justify-center bg-green-500" data-testid="badge-passport">Passport</Badge>
                <div className="text-xs text-center text-gray-500" data-testid="text-passport-date">Valid until 2027</div>
              </div>
              <div className="space-y-1" data-testid="compliance-visa">
                <Badge variant="default" className="w-full justify-center bg-red-500" data-testid="badge-visa">Visa</Badge>
                <div className="text-xs text-center text-gray-500" data-testid="text-visa-date">Renewal required</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Overview */}
        <Card data-testid="card-performance">
          <CardHeader>
            <CardTitle className="text-lg font-medium">Performance Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2" data-testid="performance-overall">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Overall Rating</span>
                <span className="font-medium" data-testid="text-overall-rating">4.2/5.0</span>
              </div>
              <Progress value={84} className="h-2" data-testid="progress-overall" />
            </div>
            
            <div className="space-y-2" data-testid="performance-technical">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Technical Skills</span>
                <span className="font-medium" data-testid="text-technical-rating">4.5/5.0</span>
              </div>
              <Progress value={90} className="h-2" data-testid="progress-technical" />
            </div>
            
            <div className="space-y-2" data-testid="performance-leadership">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Leadership</span>
                <span className="font-medium" data-testid="text-leadership-rating">3.8/5.0</span>
              </div>
              <Progress value={76} className="h-2" data-testid="progress-leadership" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
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
  const shipTypesData = dashboardData?.shipTypes;
  const complianceData = dashboardData?.compliance;
  const careerProgressionData = dashboardData?.careerProgression;
  const serviceTimelineData = dashboardData?.serviceTimeline;
  const appraisalsData = dashboardData?.appraisals;

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
        {/* LEFT COLUMN - Document Status */}
        <div className="space-y-4">
          <Card data-testid="card-document-status">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Training/Cert/Docs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-3 text-sm">
                {complianceData?.map((item, index) => {
                  const statusColor = item.status === 'compliant' ? 'bg-green-500' : item.status === 'issues' ? 'bg-red-500' : 'bg-yellow-500';
                  const testId = item.category.toLowerCase().replace(/[\s&]/g, '-');
                  return (
                    <div key={index} className="flex items-center justify-between" data-testid={`doc-${testId}`}>
                      <span className="text-gray-600">{item.category}:</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${statusColor} rounded-full`} data-testid={`status-${testId}`}></div>
                        {item.details && item.details !== '✓' && (
                          <span className="text-xs text-gray-500" data-testid={`details-${testId}`}>{item.details}</span>
                        )}
                      </div>
                    </div>
                  );
                }) ?? [
                  // Fallback data if API doesn't return compliance data
                  { category: 'Travel Docs', status: 'compliant' as const, details: '✓' },
                  { category: 'Visas', status: 'compliant' as const, details: '✓' },
                  { category: 'License & DOE', status: 'compliant' as const, details: '✓' },
                  { category: 'Training', status: 'issues' as const, details: 'Issues: 2' },
                  { category: 'Medical', status: 'compliant' as const, details: 'Last: 15 Feb 2022' },
                  { category: 'Vaccination', status: 'issues' as const, details: 'Issue: 1' }
                ].map((item, index) => {
                  const statusColor = item.status === 'compliant' ? 'bg-green-500' : item.status === 'issues' ? 'bg-red-500' : 'bg-yellow-500';
                  const testId = item.category.toLowerCase().replace(/[\s&]/g, '-');
                  return (
                    <div key={index} className="flex items-center justify-between" data-testid={`doc-${testId}`}>
                      <span className="text-gray-600">{item.category}:</span>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 ${statusColor} rounded-full`} data-testid={`status-${testId}`}></div>
                        {item.details && item.details !== '✓' && (
                          <span className="text-xs text-gray-500" data-testid={`details-${testId}`}>{item.details}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* MIDDLE COLUMN - Status + Experience + Ranks + Ship Types */}
        <div className="space-y-4">
          {/* Status Section */}
          <Card data-testid="card-status-overview">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Status</CardTitle>
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
              <CardTitle className="text-lg font-medium">Experience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-5 gap-2 text-center text-sm">
                <div>
                  <div className="text-gray-600">Company</div>
                  <div className="font-bold text-lg text-blue-600" data-testid="text-company-years">{(experienceData?.company ?? 1.2).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Rank</div>
                  <div className="font-bold text-lg text-blue-600" data-testid="text-rank-years">{(experienceData?.rank ?? 1.9).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Tankers</div>
                  <div className="font-bold text-lg text-blue-600" data-testid="text-tankers-years">{(experienceData?.tankers ?? 2.5).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-gray-600">OCW</div>
                  <div className="font-bold text-lg text-blue-600" data-testid="text-ocw-years">{(experienceData?.ocw ?? 3.6).toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-gray-600">Endors</div>
                  <div className="font-bold text-lg text-blue-600" data-testid="text-endorsements-count">{experienceData?.endorsements ?? 'OGC'}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rank Progression */}
          <Card data-testid="card-rank-progression">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Rank</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {/* Generate rank progression from careerProgressionData or use experience data for rank levels */}
                {(() => {
                  // Define rank levels with experience-based values
                  const rankLevels = [
                    { rank: 'C/E', level: 0, maxLevel: 5 },
                    { rank: '2/E', level: Math.floor((experienceData?.rank ?? 1.9) * 1.2), maxLevel: 5 },
                    { rank: '3/E', level: Math.floor((experienceData?.rank ?? 1.9) * 2), maxLevel: 5 },
                    { rank: '4/E', level: Math.min(Math.floor((experienceData?.rank ?? 1.9) * 3), 5), maxLevel: 5 }
                  ];
                  
                  return rankLevels.map((item, index) => {
                    const testId = item.rank.toLowerCase().replace('/', '');
                    const progressValue = (item.level / item.maxLevel) * 100;
                    
                    return (
                      <div key={index} className="space-y-1" data-testid={`rank-${testId}`}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">{item.rank}</span>
                          <span className="font-medium" data-testid={`rank-${testId}-value`}>{item.level}</span>
                        </div>
                        <Progress value={progressValue} className="h-2" data-testid={`progress-${testId}`} />
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Ship Type Experience */}
          <Card data-testid="card-ship-experience">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Ship Type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2" data-testid="ship-type-oil-tanker">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Oil Tkr</span>
                  <span className="font-medium" data-testid="text-oil-tanker-years">{(shipTypesData?.oilTanker ?? 4.2).toFixed(1)} years</span>
                </div>
                <Progress value={(shipTypesData?.oilTanker ?? 4.2) * 20} className="h-2" data-testid="progress-oil-tanker" />
              </div>
              
              <div className="space-y-2" data-testid="ship-type-chemical-tanker">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ch. Tkr</span>
                  <span className="font-medium" data-testid="text-chemical-tanker-years">{(shipTypesData?.chemicalTanker ?? 5.1).toFixed(1)} years</span>
                </div>
                <Progress value={(shipTypesData?.chemicalTanker ?? 5.1) * 20} className="h-2" data-testid="progress-chemical-tanker" />
              </div>
              
              <div className="space-y-2" data-testid="ship-type-gas-tanker">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gas Tkr</span>
                  <span className="font-medium" data-testid="text-gas-tanker-years">{(shipTypesData?.gasTanker ?? 3.2).toFixed(1)} years</span>
                </div>
                <Progress value={(shipTypesData?.gasTanker ?? 3.2) * 20} className="h-2" data-testid="progress-gas-tanker" />
              </div>
              
              <div className="space-y-2" data-testid="ship-type-bulk">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Bulk</span>
                  <span className="font-medium" data-testid="text-bulk-years">{(shipTypesData?.bulk ?? 1.1).toFixed(1)} years</span>
                </div>
                <Progress value={(shipTypesData?.bulk ?? 1.1) * 20} className="h-2" data-testid="progress-bulk" />
              </div>
            </CardContent>
          </Card>

          {/* Promotion Section */}
          <Card data-testid="card-promotion">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Promotion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div>
                  <div className="text-gray-600">Recommend</div>
                  <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" data-testid="promotion-recommend"></div>
                </div>
                <div>
                  <div className="text-gray-600">Decline</div>
                  <div className="w-3 h-3 bg-yellow-500 rounded-full mx-auto" data-testid="promotion-decline"></div>
                </div>
                <div>
                  <div className="text-gray-600">Shortlist</div>
                  <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" data-testid="promotion-shortlist"></div>
                </div>
                <div>
                  <div className="text-gray-600">Approved</div>
                  <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" data-testid="promotion-approved"></div>
                </div>
              </div>
              <div className="space-y-1 text-sm">
                {careerProgressionData?.map((step, index) => {
                  const testId = step.position.toLowerCase().replace(/[\s\/]/g, '-');
                  return (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">{step.position}</span>
                      <span data-testid={`promotion-${testId}`}>{step.date || '-'}</span>
                    </div>
                  );
                }) ?? [
                  // Fallback data if API doesn't return career progression
                  { position: 'To C/E', date: '22 Jan 2017' },
                  { position: 'To 2/E', date: '12 Dec 2014' },
                  { position: 'To 3/E', date: undefined }
                ].map((step, index) => {
                  const testId = step.position.toLowerCase().replace(/[\s\/]/g, '-');
                  return (
                    <div key={index} className="flex justify-between">
                      <span className="text-gray-600">{step.position}</span>
                      <span data-testid={`promotion-${testId}`}>{step.date || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN - Timeline + Appraisals */}
        <div className="space-y-4">
          {/* Timeline */}
          <Card data-testid="card-timeline">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Timeline visualization with colored bars */}
              <div className="space-y-2">
                <div className="grid grid-cols-6 gap-1 text-xs text-center text-gray-600">
                  <span data-testid="month-jan">Jan</span>
                  <span data-testid="month-feb">Feb</span>
                  <span data-testid="month-mar">Mar</span>
                  <span data-testid="month-apr">Apr</span>
                  <span data-testid="month-may">May</span>
                  <span data-testid="month-jun">Jun</span>
                </div>
                {serviceTimelineData?.map((assignment, index) => {
                  const width = ((assignment.endMonth - assignment.startMonth + 1) / 6) * 100;
                  const left = ((assignment.startMonth - 1) / 6) * 100;
                  const bgColor = assignment.type === 'active' ? 'bg-blue-400' : 'bg-gray-400';
                  return (
                    <div key={index} className={`${bgColor} h-4 rounded relative`} 
                         style={{ width: `${width}%`, marginLeft: `${left}%` }}
                         data-testid={`timeline-bar-${assignment.vessel.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className="absolute left-2 top-1 text-xs text-white font-medium"
                           data-testid={`vessel-label-${assignment.vessel.toLowerCase().replace(/\s+/g, '-')}`}>
                        {assignment.vessel}
                      </div>
                    </div>
                  );
                }) ?? [
                  // Fallback if no timeline data
                  <div key="default" className="bg-blue-400 h-4 rounded relative" data-testid="timeline-bar">
                    <div className="absolute left-2 top-1 text-xs text-white font-medium">Pacific Explorer</div>
                  </div>
                ]}
                <div className="flex items-center gap-2 text-xs">
                  {serviceTimelineData?.map((assignment, index) => (
                    <div key={index} className="flex items-center gap-1" data-testid={`legend-${assignment.vessel.toLowerCase().replace(/\s+/g, '-')}`}>
                      <div className={`w-3 h-3 rounded ${assignment.type === 'active' ? 'bg-blue-400' : 'bg-gray-400'}`}></div>
                      <span className="text-gray-600">{assignment.vessel}</span>
                    </div>
                  )) ?? [
                    <div key="pacific" className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-blue-400 rounded"></div>
                      <span className="text-gray-600">Pacific Explorer</span>
                    </div>,
                    <div key="atlantic" className="flex items-center gap-1 ml-4">
                      <div className="w-3 h-3 bg-orange-400 rounded"></div>
                      <span className="text-gray-600">Atlantic Explorer</span>
                    </div>
                  ]}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appraisals Chart */}
          <Card data-testid="card-appraisals">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Appraisals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Simple area chart representation */}
              <div className="relative h-32 bg-gray-50 rounded" data-testid="appraisals-chart">
                <div className="absolute bottom-0 w-full h-16 bg-gradient-to-t from-blue-200 to-blue-100 rounded-b"></div>
                <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-purple-200 to-transparent rounded-b opacity-70"></div>
                <div className="absolute bottom-2 left-2 text-xs text-gray-600">2014</div>
                <div className="absolute bottom-2 right-2 text-xs text-gray-600">2024</div>
                <div className="absolute top-2 left-2 text-xs text-gray-600">36</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs text-center">
                <div>
                  <div className="font-medium text-lg" data-testid="score-current">
                    {appraisalsData && appraisalsData.length > 0 ? appraisalsData[appraisalsData.length - 1].score : 34}
                  </div>
                  <div className="text-gray-600">Current Score</div>
                </div>
                <div>
                  <div className="font-medium text-lg" data-testid="score-average">
                    {appraisalsData && appraisalsData.length > 0 
                      ? Math.round(appraisalsData.reduce((sum, point) => sum + point.score, 0) / appraisalsData.length)
                      : 28}
                  </div>
                  <div className="text-gray-600">Average</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
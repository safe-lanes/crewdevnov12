import { useExternalVessels, getExternalVesselsDomain } from '@/hooks/useExternalVessels';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, Ship, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

/**
 * Test component for manually verifying the useExternalVessels hook
 * 
 * This component displays:
 * - Current domain being used
 * - Loading state while fetching
 * - Error state if fetch fails
 * - Success state with vessel list
 * - Refetch button for testing manual refresh
 */
export function TestExternalVessels() {
  const { data: vessels, isLoading, error, refetch, isFetching, isSuccess } = useExternalVessels();
  const domain = getExternalVesselsDomain();

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-testid="test-external-vessels-container">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ship className="h-5 w-5" />
            External Vessels API Test
          </CardTitle>
          <CardDescription>
            Testing the useExternalVessels hook connection to SAIL ERP API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Domain Parameter</p>
              <Badge variant="outline" data-testid="domain-badge">{domain}</Badge>
            </div>
            <Button 
              onClick={() => refetch()} 
              disabled={isFetching}
              variant="outline"
              data-testid="refetch-button"
            >
              {isFetching ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refetch
            </Button>
          </div>

          <div className="flex gap-2 flex-wrap">
            <Badge variant={isLoading ? "default" : "secondary"} data-testid="status-loading">
              {isLoading ? "Loading..." : "Not Loading"}
            </Badge>
            <Badge variant={isFetching ? "default" : "secondary"} data-testid="status-fetching">
              {isFetching ? "Fetching..." : "Not Fetching"}
            </Badge>
            <Badge variant={isSuccess ? "default" : "secondary"} data-testid="status-success">
              {isSuccess ? "Success" : "Not Loaded"}
            </Badge>
            <Badge variant={error ? "destructive" : "secondary"} data-testid="status-error">
              {error ? "Error" : "No Error"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Alert data-testid="loading-alert">
          <Loader2 className="h-4 w-4 animate-spin" />
          <AlertTitle>Loading Vessels</AlertTitle>
          <AlertDescription>
            Fetching vessel data from external API...
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" data-testid="error-alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Fetching Vessels</AlertTitle>
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      )}

      {isSuccess && vessels && (
        <Card data-testid="success-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Vessels Loaded Successfully
            </CardTitle>
            <CardDescription>
              Total vessels: {vessels.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] rounded-md border p-4">
              <div className="space-y-2">
                {vessels.map((vessel, index) => (
                  <div 
                    key={vessel.id || index} 
                    className="p-3 rounded-lg bg-muted/50 flex justify-between items-center"
                    data-testid={`vessel-item-${index}`}
                  >
                    <div>
                      <p className="font-medium">{vessel.name || 'Unnamed Vessel'}</p>
                      <p className="text-sm text-muted-foreground">
                        ID: {vessel.id} | Type: {vessel.vesselType || 'N/A'}
                      </p>
                    </div>
                    {vessel.status && (
                      <Badge variant="outline">{vessel.status}</Badge>
                    )}
                  </div>
                ))}
                {vessels.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    No vessels returned from API
                  </p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>API Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Endpoint:</span>
            <code className="ml-2 p-1 bg-muted rounded text-xs">
              https://dev.sl-sail.com/b/api/v1/crewmasterdata/getallmasterdata/vessels
            </code>
          </div>
          <div>
            <span className="font-medium">Query Parameters:</span>
            <code className="ml-2 p-1 bg-muted rounded text-xs">
              domain={domain}
            </code>
          </div>
          <div>
            <span className="font-medium">Stale Time:</span>
            <code className="ml-2 p-1 bg-muted rounded text-xs">5 minutes</code>
          </div>
          <div>
            <span className="font-medium">Retry Count:</span>
            <code className="ml-2 p-1 bg-muted rounded text-xs">2</code>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TestExternalVessels;

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface VesselListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  vesselIds: Set<string>;
  actionType: 'vesselReview' | 'officeReview' | 'records';
  monthValue: string;
  onVesselReviewClick?: (vesselId: string, vesselName: string) => void;
  onRecordsClick?: (vesselId: string, vesselName: string) => void;
}

export const VesselListDialog = ({
  open,
  onOpenChange,
  title,
  vesselIds,
  actionType,
  monthValue,
  onVesselReviewClick,
  onRecordsClick,
}: VesselListDialogProps) => {
  // Fetch vessel master data
  const { data: allVessels = [] } = useQuery<Array<{ id: number; entryId: string; name: string }>>({
    queryKey: ['/api/masters/014/data'],
    enabled: open,
  });

  // Filter vessels to show only those in the provided set
  const vessels = useMemo(() => {
    return allVessels
      .filter(v => vesselIds.has(v.entryId))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allVessels, vesselIds]);

  const handleActionClick = (vesselId: string, vesselName: string) => {
    if (actionType === 'vesselReview' || actionType === 'officeReview') {
      onVesselReviewClick?.(vesselId, vesselName);
    } else if (actionType === 'records') {
      onRecordsClick?.(vesselId, vesselName);
    }
  };

  const getActionButtonText = () => {
    if (actionType === 'vesselReview') return 'Vessel Review';
    if (actionType === 'officeReview') return 'Office Review';
    return 'View Records';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          {vessels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No vessels found
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vessel Name</TableHead>
                    <TableHead className="w-[150px] text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vessels.map((vessel) => (
                    <TableRow key={vessel.entryId}>
                      <TableCell className="font-medium">{vessel.name}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleActionClick(vessel.entryId, vessel.name)}
                          className="h-8 gap-2"
                          data-testid={`button-action-${vessel.entryId}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                          {getActionButtonText()}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

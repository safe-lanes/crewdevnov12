import { memo, Fragment } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MessageSquare, Trash2 } from "lucide-react";
import { PartCProps } from "./types";

const PartCComponent: React.FC<PartCProps> = ({
  form,
  partRef,
  competenceComments,
  setCompetenceComments,
  editingCompetenceComment,
  setEditingCompetenceComment,
  updateCompetenceAssessment,
  competenceSectionScore,
  getScoreColors,
}) => {
  const deleteCompetenceComment = (id: string) => {
    setCompetenceComments(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const scoreValue = parseFloat(competenceSectionScore) || 0;
  const { bgColor, textColor } = getScoreColors(scoreValue);

  return (
    <div ref={partRef} data-section-id="C">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part C: Competence Assessment (Professional Knowledge & Skills)</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Select the most appropriate rating basis assessment of the specific criterion</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">S.No</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Assessment Criteria</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Weight %</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Effectiveness</th>
                  <th className="text-gray-600 text-xs font-normal py-2 px-4 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {form.watch("competenceAssessments").map((assessment, index) => (
                  <Fragment key={assessment.id}>
                    <tr className="border-t">
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{index + 1}.</td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{assessment.assessmentCriteria}</td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">{assessment.weight}%</td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <Select value={assessment.effectiveness} onValueChange={(value) => updateCompetenceAssessment(assessment.id, "effectiveness", value)}>
                          <SelectTrigger className="border-0 bg-transparent p-0 focus-visible:ring-0 text-[#4f5863] text-[13px] font-normal h-6">
                            <SelectValue placeholder="Select Rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="5-exceeds-expectations">5- Exceeds Expectations</SelectItem>
                            <SelectItem value="4-meets-expectations">4- Meets Expectations</SelectItem>
                            <SelectItem value="3-somewhat-meets-expectations">3- Somewhat Meets Expectations</SelectItem>
                            <SelectItem value="2-below-expectations">2- Below Expectations</SelectItem>
                            <SelectItem value="1-significantly-below-expectations">1- Significantly Below Expectations</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="text-[#4f5863] text-[13px] font-normal py-2 px-4">
                        <div className="flex gap-2 justify-center">
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCompetenceComments(prev => ({ ...prev, [assessment.id]: prev[assessment.id] || "" }))}>
                            <MessageSquare className="h-[18px] w-[18px] text-gray-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {competenceComments[assessment.id] !== undefined && (
                      <tr>
                        <td></td>
                        <td colSpan={4} className="p-3">
                          {editingCompetenceComment === assessment.id ? (
                            <Textarea
                              value={competenceComments[assessment.id]}
                              onChange={(e) => { setCompetenceComments(prev => ({ ...prev, [assessment.id]: e.target.value })); updateCompetenceAssessment(assessment.id, "comment", e.target.value); }}
                              onBlur={() => setEditingCompetenceComment(null)}
                              placeholder="Comment: Add your observations here..."
                              className="text-blue-600 italic border-blue-200"
                              rows={2}
                              autoFocus
                            />
                          ) : (
                            <div className="flex justify-between items-start">
                              <div className="flex-1 text-blue-600 italic cursor-pointer p-2 rounded hover:bg-gray-50 text-[13px]" onClick={() => setEditingCompetenceComment(assessment.id)}>
                                {competenceComments[assessment.id] || "Click to add comment..."}
                              </div>
                              <div className="ml-2">
                                <Button type="button" variant="ghost" size="sm" onClick={() => deleteCompetenceComment(assessment.id)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="text-right font-medium py-3 px-4">Competence Section Score:</td>
                  <td className="py-3 px-4">
                    <span className={`px-3 py-1 rounded-full font-semibold ${bgColor} ${textColor}`}>
                      {competenceSectionScore}
                    </span>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartC = memo(PartCComponent);

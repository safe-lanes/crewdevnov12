import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PartAProps, NATIONALITIES } from "./types";

const PartAComponent: React.FC<PartAProps> = ({
  form,
  partRef,
  vessels,
  availableRanks,
  appraisalTypes,
  isFieldVisible,
}) => {
  return (
    <div ref={partRef} data-section-id="A">
      <Card className="bg-white">
        <CardContent className="p-6">
          <div className="pb-4 mb-6">
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#16569e' }}>Part A: Seafarer's Information</h3>
            <div style={{ color: '#16569e' }} className="text-sm">Enter details as applicable</div>
            <div className="w-full h-0.5 mt-2" style={{ backgroundColor: '#16569e' }}></div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="seafarersName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter seafarer's name" className="bg-[#ffffff]" data-testid="input-seafarers-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="seafarersRank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Seafarer's Rank</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#ffffff]" data-testid="select-seafarers-rank">
                          <SelectValue placeholder="Select rank" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableRanks.map((rank) => (
                          <SelectItem key={rank.id} value={rank.name}>
                            {rank.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nationality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Nationality</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter nationality" className="bg-[#ffffff]" data-testid="input-nationality" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="vessel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Vessel</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#ffffff]" data-testid="select-vessel">
                          <SelectValue placeholder="Select vessel" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {vessels.map((vessel) => (
                          <SelectItem key={vessel.entryId} value={vessel.name}>
                            {vessel.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signOn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Sign On Date</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="dd/mm/yyyy" type="date" className="bg-[#ffffff]" data-testid="input-sign-on" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appraisalType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#ffffff]" data-testid="select-appraisal-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {appraisalTypes.length > 0 ? (
                          appraisalTypes.map((type) => (
                            <SelectItem key={type.id} value={type.name}>
                              {type.name}
                            </SelectItem>
                          ))
                        ) : (
                          <>
                            <SelectItem value="end-of-contract">End of Contract</SelectItem>
                            <SelectItem value="mid-term">Mid Term</SelectItem>
                            <SelectItem value="special">Special</SelectItem>
                            <SelectItem value="probation">Probation</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="appraisalPeriodFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period From</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-[#ffffff]" data-testid="input-period-from" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="appraisalPeriodTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Appraisal Period To</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="dd.mm.yyyy" type="date" className="bg-[#ffffff]" data-testid="input-period-to" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryAppraiser"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-gray-500 tracking-wide">Primary Appraiser</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-[#ffffff]" data-testid="select-primary-appraiser">
                          <SelectValue placeholder="Select appraiser" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="master">Master</SelectItem>
                        <SelectItem value="chief-officer">Chief Officer</SelectItem>
                        <SelectItem value="chief-engineer">Chief Engineer</SelectItem>
                        <SelectItem value="2nd-engineer">2nd Engineer</SelectItem>
                        <SelectItem value="marine-superintendent">Marine Superintendent</SelectItem>
                        <SelectItem value="technical-superintendent">Technical Superintendent</SelectItem>
                        <SelectItem value="crew-manager">Crew Manager</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isFieldVisible('personalityIndexCategory') && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="personalityIndexCategory"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-gray-500 tracking-wide">Personality Index (PI) Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-[#ffffff]" data-testid="select-pi-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="dominance">Dominance</SelectItem>
                          <SelectItem value="influence">Influence</SelectItem>
                          <SelectItem value="steadiness">Steadiness</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const PartA = memo(PartAComponent);


import {
  EditIcon,
  EyeIcon,
  FilterIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import React, { useState } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface BaseSubmoduleTableProps {
  title: string;
  data: any[];
  columns: {
    key: string;
    header: string;
    render?: (item: any) => React.ReactNode;
  }[];
  filters?: {
    key: string;
    placeholder: string;
    options?: { value: string; label: string }[];
    type?: 'search' | 'select';
  }[];
  onEdit?: (item: any) => void;
  onView?: (item: any) => void;
  onDelete?: (item: any) => void;
  isLoading?: boolean;
  activeModule?: string;
}

export const BaseSubmoduleTable: React.FC<BaseSubmoduleTableProps> = ({
  title,
  data,
  columns,
  filters = [],
  onEdit,
  onView,
  onDelete,
  isLoading = false,
  activeModule = "Appraisals"
}) => {
  const [showFilters, setShowFilters] = useState(true);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  // Filter data based on filter values
  const filteredData = data.filter((item) => {
    return Object.entries(filterValues).every(([key, value]) => {
      if (!value) return true;
      
      const itemValue = item[key];
      if (typeof itemValue === 'string') {
        return itemValue.toLowerCase().includes(value.toLowerCase());
      }
      return itemValue === value;
    });
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilterValues(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilterValues({});
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading {title.toLowerCase()}...</div>
      </div>
    );
  }

  return (
    <div className="bg-transparent flex flex-row justify-center w-full">
      <div className="overflow-hidden bg-[url(/figmaAssets/vector.svg)] bg-[100%_100%] w-[1440px] h-[900px] relative">
        {/* Header */}
        <header className="w-full h-[67px] bg-[#E8E8E8] border-b-2 border-[#5DADE2]">
          <div className="flex items-center h-full">
            {/* Logo */}
            <div className="flex items-center ml-4">
              <img
                className="w-14 h-10"
                alt="Logo"
                src="/figmaAssets/group-2.png"
              />
            </div>

            {/* Navigation Menu */}
            <nav className="flex ml-8">
              {/* Crewing Section */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] border-r border-gray-300">
                <div className="w-6 h-6 mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="14" y="3" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="3" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                    <rect x="14" y="14" width="7" height="7" rx="1" fill="#6B7280"/>
                  </svg>
                </div>
                <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
                  Crewing
                </div>
              </div>

              {/* Active Module Section */}
              <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#5DADE2] border-r border-gray-300">
                <div className="w-6 h-6 mb-1">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.89 22 5.99 22H18C19.1 22 20 21.1 20 20V8L14 2Z" fill="white"/>
                    <path d="M14 2V8H20" fill="white"/>
                    <path d="M16 11H8V13H16V11Z" fill="#5DADE2"/>
                    <path d="M16 15H8V17H16V15Z" fill="#5DADE2"/>
                  </svg>
                </div>
                <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
                  {activeModule}
                </div>
              </div>

              {/* Admin Section */}
              <Link href="/admin">
                <div className="flex flex-col items-center justify-center w-[100px] h-[67px] bg-[#E8E8E8] cursor-pointer hover:bg-gray-300">
                  <div className="w-6 h-6 mb-1">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 1L15.09 8.26L23 9L17 14.74L18.18 22.02L12 19L5.82 22.02L7 14.74L1 9L8.91 8.26L12 1Z" fill="#6B7280"/>
                    </svg>
                  </div>
                  <div className="text-[#4f5863] text-[10px] font-normal font-['Mulish',Helvetica]">
                    Admin
                  </div>
                </div>
              </Link>
            </nav>

            {/* User Profile */}
            <div className="absolute top-2.5 right-[38px]">
              <img
                className="w-[38px] h-[37px]"
                alt="User"
                src="/figmaAssets/group-3.png"
              />
            </div>
          </div>
        </header>

        {/* Left sidebar */}
        <aside className="w-[67px] absolute left-0 top-[66px] h-[calc(100vh-66px)]">
          <div className="w-full h-[79px] flex flex-col items-center justify-center bg-[#52baf3]">
            <div className="w-6 h-6 mb-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="white"/>
                <path d="M19 15L19.74 17.74L22 18L19.74 18.26L19 21L18.26 18.26L16 18L18.26 17.74L19 15Z" fill="white"/>
                <path d="M5 6L5.5 7.5L7 8L5.5 8.5L5 10L4.5 8.5L3 8L4.5 7.5L5 6Z" fill="white"/>
              </svg>
            </div>
            <div className="text-white text-[10px] font-normal font-['Roboto',Helvetica]">
              All
            </div>
          </div>
          <div className="w-full h-[calc(100%-79px)] bg-[#16569e]"></div>
        </aside>

        {/* Main content */}
        <main className="absolute top-[67px] left-[67px] w-[calc(100%-67px)] h-[calc(100%-67px)]">
          <div className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="font-['Mulish',Helvetica] font-bold text-black text-[22px] ml-[19px] mr-[19px]">
                {title}
              </h1>
              <Button
                variant="outline"
                className="h-10 border-[#e1e8ed] text-[#16569e] flex items-center gap-2 ml-[19px] mr-[19px]"
                onClick={() => setShowFilters(!showFilters)}
              >
                <FilterIcon className="w-4 h-4" />
                <span className="text-sm">Filters</span>
              </Button>
            </div>

            {/* Filters */}
            {showFilters && filters.length > 0 && (
              <div className="flex justify-between items-center gap-2 mb-6 ml-4 mr-4">
                <div className="flex gap-2">
                  {filters.map((filter) => (
                    <div key={filter.key} className="relative">
                      {filter.type === 'search' ? (
                        <div className="relative w-[180px]">
                          <Input
                            className="h-8 pl-10 text-[#8798ad] text-xs"
                            placeholder={filter.placeholder}
                            value={filterValues[filter.key] || ''}
                            onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                          />
                          <SearchIcon className="w-4 h-4 absolute left-3 top-2 text-[#8798ad]" />
                        </div>
                      ) : (
                        <Select 
                          value={filterValues[filter.key] || ''} 
                          onValueChange={(value) => handleFilterChange(filter.key, value)}
                        >
                          <SelectTrigger className="w-[150px] h-8 bg-white text-[#8a8a8a] text-xs">
                            <SelectValue placeholder={filter.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {filter.options?.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button className="h-8 w-20 bg-[#16569e] hover:bg-[#0d4a8f] text-[11px]">
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-20 text-[#8798ad] text-xs border-[#e1e8ed]"
                    onClick={clearFilters}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            <Card className="border-0 shadow-none bg-[#f7fafc] rounded-lg">
              <CardContent className="p-4 bg-[#f7fafc]">
                <Table className="bg-white rounded-lg shadow-md overflow-hidden">
                  <TableHeader className="bg-[#52baf3]">
                    <TableRow>
                      {columns.map((column) => (
                        <TableHead key={column.key} className="text-white text-xs font-normal">
                          {column.header}
                        </TableHead>
                      ))}
                      <TableHead className="text-white text-xs font-normal w-24">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="bg-white">
                    {filteredData.map((item, index) => (
                      <TableRow
                        key={index}
                        className="border-b border-gray-200 bg-white hover:bg-gray-50"
                      >
                        {columns.map((column) => (
                          <TableCell key={column.key} className="text-[#4f5863] text-[13px] font-normal py-3">
                            {column.render ? column.render(item) : item[column.key]}
                          </TableCell>
                        ))}
                        <TableCell>
                          <div className="flex gap-2 justify-center">
                            {onView && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onView(item)}
                              >
                                <EyeIcon className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            )}
                            {onEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onEdit(item)}
                              >
                                <EditIcon className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onDelete(item)}
                              >
                                <Trash2Icon className="h-[18px] w-[18px] text-gray-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Pagination */}
            <div className="mt-4 text-xs font-normal font-['Mulish',Helvetica] text-black">
              {filteredData.length > 0 ? `1 to ${filteredData.length} of ${filteredData.length}` : "0 to 0 of 0"}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

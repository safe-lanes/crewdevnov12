import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  TextInput,
  TextareaInput,
  SelectInput,
  DateInput,
  CheckboxInput,
  RadioInput,
  SwitchInput,
  FileInput,
  SearchInput,
  type SelectOption,
  type RadioOption,
} from '@/components/common';

export default function ComponentDemo() {
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    bio: '',
    country: '',
    birthDate: undefined as Date | undefined,
    newsletter: false,
    theme: '',
    notifications: false,
    files: null as FileList | null,
    search: '',
  });

  // Options for select and radio components
  const countryOptions: SelectOption[] = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
    { value: 'de', label: 'Germany' },
    { value: 'fr', label: 'France' },
    { value: 'jp', label: 'Japan' },
  ];

  const themeOptions: RadioOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form data:', formData);
    alert('Form submitted! Check console for data.');
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      bio: '',
      country: '',
      birthDate: undefined,
      newsletter: false,
      theme: '',
      notifications: false,
      files: null,
      search: '',
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Common Form Inputs Demo</h1>
          <p className="text-muted-foreground mt-2">
            Reusable input components with consistent styling and behavior
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Text Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <TextInput
                  label="Full Name"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
                  required
                  description="Your legal name as it appears on official documents"
                />

                <TextInput
                  type="email"
                  label="Email Address"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(value) => setFormData(prev => ({ ...prev, email: value }))}
                  required
                  description="We'll never share your email with anyone"
                />
              </div>

              <TextareaInput
                label="Biography"
                placeholder="Tell us about yourself..."
                value={formData.bio}
                onChange={(value) => setFormData(prev => ({ ...prev, bio: value }))}
                rows={4}
                maxLength={500}
                description="A brief description about yourself (max 500 characters)"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Selection Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SelectInput
                  label="Country"
                  placeholder="Select your country"
                  value={formData.country}
                  onChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                  options={countryOptions}
                  searchable
                  clearable
                  required
                  description="Your country of residence"
                />

                <DateInput
                  label="Date of Birth"
                  placeholder="Pick your birth date"
                  value={formData.birthDate}
                  onChange={(date) => setFormData(prev => ({ ...prev, birthDate: date }))}
                  maxDate={new Date()}
                  required
                  description="You must be at least 18 years old"
                />
              </div>

              <RadioInput
                label="Preferred Theme"
                value={formData.theme}
                onChange={(value) => setFormData(prev => ({ ...prev, theme: value }))}
                options={themeOptions}
                orientation="horizontal"
                description="Choose your preferred application theme"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Boolean Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <CheckboxInput
                label="Subscribe to newsletter"
                checked={formData.newsletter}
                onChange={(checked) => setFormData(prev => ({ ...prev, newsletter: checked }))}
                description="Receive weekly updates about new features and news"
              />

              <SwitchInput
                label="Enable notifications"
                checked={formData.notifications}
                onChange={(checked) => setFormData(prev => ({ ...prev, notifications: checked }))}
                description="Get notified about important updates and messages"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>File & Search Inputs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <FileInput
                label="Profile Documents"
                accept=".pdf,.doc,.docx,.jpg,.png"
                multiple
                onChange={(files) => setFormData(prev => ({ ...prev, files }))}
                maxSize={5 * 1024 * 1024} // 5MB
                allowedTypes={['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']}
                showPreview
                description="Upload your profile documents (PDF, DOC, DOCX, JPG, PNG - max 5MB each)"
              />

              <SearchInput
                label="Search Users"
                placeholder="Type to search users..."
                value={formData.search}
                onChange={(value) => setFormData(prev => ({ ...prev, search: value }))}
                onSearch={(value) => console.log('Searching for:', value)}
                debounceMs={500}
                description="Search functionality with 500ms debounce"
              />
            </CardContent>
          </Card>

          <Separator />

          <div className="flex justify-between items-center">
            <Button type="button" variant="outline" onClick={resetForm}>
              Reset Form
            </Button>
            <Button type="submit">
              Submit Form
            </Button>
          </div>
        </form>

        <Card>
          <CardHeader>
            <CardTitle>Form Data Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-4 rounded overflow-auto">
              {JSON.stringify(
                {
                  ...formData,
                  files: formData.files ? Array.from(formData.files).map(f => ({ name: f.name, size: f.size })) : null,
                },
                null,
                2
              )}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
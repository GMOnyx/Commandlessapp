import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  BookOpen, 
  FileText, 
  Film, 
  CheckCircle,
  Users,
  Star,
  PlusCircle,
  Calendar,
  PlayCircle,
  Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Form schema for creating new training content
const trainingSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  category: z.string().min(1, "Please select a category"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  contentType: z.string().min(1, "Please select a content type"),
  targetAudience: z.string().min(1, "Please select a target audience"),
  estimatedTime: z.string().min(1, "Please provide estimated completion time"),
  author: z.string().optional(),
  attachment: z.any().optional(),
});

// Static data for demo purposes
const trainingMaterials = [
  {
    id: 1,
    title: "Brand Voice Guidelines",
    category: "marketing",
    description: "Learn the approved tone and vocabulary for all company communications",
    contentType: "document",
    estimatedTime: "45 min",
    status: "published",
    dateCreated: "2023-04-10",
    author: "Marketing Team",
    enrolled: 12,
    completed: 8,
    rating: 4.7
  },
  {
    id: 2,
    title: "Social Media Strategy Fundamentals",
    category: "marketing",
    description: "Introduction to building effective social media campaigns",
    contentType: "course",
    estimatedTime: "2 hours",
    status: "published",
    dateCreated: "2023-03-22",
    author: "Sarah Johnson",
    enrolled: 18,
    completed: 14,
    rating: 4.5
  },
  {
    id: 3,
    title: "Content Creation Best Practices",
    category: "marketing",
    description: "Guidelines for creating engaging content across platforms",
    contentType: "video",
    estimatedTime: "1 hour",
    status: "published",
    dateCreated: "2023-05-05",
    author: "Content Team",
    enrolled: 15,
    completed: 9,
    rating: 4.8
  },
  {
    id: 4,
    title: "Advanced Analytics Workshop",
    category: "analytics",
    description: "Deep dive into marketing analytics tools and metrics",
    contentType: "workshop",
    estimatedTime: "3 hours",
    status: "draft",
    dateCreated: "2023-06-01",
    author: "Data Analytics Team",
    enrolled: 0,
    completed: 0,
    rating: 0
  },
  {
    id: 5,
    title: "Customer Persona Development",
    category: "marketing",
    description: "Learn how to create detailed customer personas",
    contentType: "document",
    estimatedTime: "1.5 hours",
    status: "published",
    dateCreated: "2023-04-28",
    author: "Marketing Strategy Team",
    enrolled: 10,
    completed: 7,
    rating: 4.3
  }
];

// Upcoming training sessions
const upcomingTrainingSessions = [
  {
    id: 1,
    title: "Q3 Marketing Strategy Workshop",
    date: "2023-07-15",
    time: "10:00 AM - 12:00 PM",
    instructor: "Marketing Director",
    location: "Conference Room A",
    participants: 12,
    capacity: 15
  },
  {
    id: 2,
    title: "Content Creation Masterclass",
    date: "2023-07-22",
    time: "2:00 PM - 4:00 PM",
    instructor: "Senior Content Strategist",
    location: "Virtual Meeting",
    participants: 8,
    capacity: 20
  },
  {
    id: 3,
    title: "Social Media Analytics Deep Dive",
    date: "2023-08-05",
    time: "1:00 PM - 3:30 PM",
    instructor: "Social Media Manager",
    location: "Conference Room B",
    participants: 6,
    capacity: 10
  }
];

export default function Training() {
  const [activeTab, setActiveTab] = useState("library");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { toast } = useToast();
  
  // Form for adding new training material
  const form = useForm<z.infer<typeof trainingSchema>>({
    resolver: zodResolver(trainingSchema),
    defaultValues: {
      title: "",
      category: "",
      description: "",
      contentType: "",
      targetAudience: "",
      estimatedTime: "",
      author: "",
    }
  });
  
  const onSubmit = (data: z.infer<typeof trainingSchema>) => {
    // In a real app, this would create a new training material
    toast({
      title: "Training material created",
      description: `Added "${data.title}" to training library`,
    });
    form.reset();
  };
  
  // Filter training materials by search term and category
  const filteredMaterials = trainingMaterials.filter((material) => {
    const matchesSearch = searchTerm
      ? material.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.description.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
      
    const matchesCategory = categoryFilter === "all" 
      ? true 
      : material.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });
  
  // Calculate training statistics
  const totalMaterials = trainingMaterials.length;
  const publishedMaterials = trainingMaterials.filter(m => m.status === "published").length;
  const totalEnrollments = trainingMaterials.reduce((acc, curr) => acc + curr.enrolled, 0);
  const completionRate = Math.round(
    trainingMaterials.reduce((acc, curr) => acc + (curr.completed / (curr.enrolled || 1) * 100), 0) / totalMaterials
  );
  
  // Render icon based on content type
  const getContentTypeIcon = (contentType: string) => {
    switch (contentType) {
      case "document":
        return <FileText className="h-4 w-4" />;
      case "video":
        return <Film className="h-4 w-4" />;
      case "course":
        return <BookOpen className="h-4 w-4" />;
      case "workshop":
        return <Users className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };
  
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Training Materials</h1>
      
      {/* Training Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <BookOpen className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Materials</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalMaterials}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Published</p>
              <h3 className="text-2xl font-bold text-gray-900">{publishedMaterials}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Enrollments</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalEnrollments}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-orange-100 p-3 rounded-full mr-4">
              <Star className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Completion Rate</p>
              <h3 className="text-2xl font-bold text-gray-900">{completionRate}%</h3>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="library">Material Library</TabsTrigger>
          <TabsTrigger value="sessions">Training Sessions</TabsTrigger>
          <TabsTrigger value="new">Add New Material</TabsTrigger>
        </TabsList>
        
        {/* Training Library Tab */}
        <TabsContent value="library" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <CardTitle>Training Material Library</CardTitle>
                  <CardDescription>
                    Browse and access training materials for the marketing team
                  </CardDescription>
                </div>
                <div className="mt-4 sm:mt-0">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Material
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                      <DialogHeader>
                        <DialogTitle>Add New Training Material</DialogTitle>
                        <DialogDescription>
                          Upload new content to the training library.
                        </DialogDescription>
                      </DialogHeader>
                      {/* Form content would go here - similar to the 'new' tab */}
                      <div className="py-4">
                        <p>Please use the "Add New Material" tab to create new training content.</p>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="search"
                      placeholder="Search materials..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <Select
                    value={categoryFilter}
                    onValueChange={(value) => setCategoryFilter(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="analytics">Analytics</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="strategy">Strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {filteredMaterials.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredMaterials.map((material) => (
                    <Card key={material.id} className="overflow-hidden">
                      <div className={`h-2 ${
                        material.contentType === 'document' ? 'bg-blue-500' :
                        material.contentType === 'video' ? 'bg-red-500' :
                        material.contentType === 'course' ? 'bg-green-500' :
                        'bg-purple-500'
                      }`}></div>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-medium text-gray-900">{material.title}</h3>
                          <Badge variant={material.status === 'published' ? 'default' : 'outline'}>
                            {material.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">{material.description}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          <div className="flex items-center text-xs text-gray-500">
                            {getContentTypeIcon(material.contentType)}
                            <span className="ml-1">{material.contentType}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock className="h-4 w-4" />
                            <span className="ml-1">{material.estimatedTime}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-500">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="ml-1">{material.rating || 'N/A'}</span>
                          </div>
                        </div>
                        <div className="flex justify-between">
                          <p className="text-xs text-gray-500">Created: {material.dateCreated}</p>
                          <Button size="sm" variant="outline">
                            {material.contentType === 'video' || material.contentType === 'course' ? (
                              <>
                                <PlayCircle className="mr-1 h-4 w-4" />
                                Start
                              </>
                            ) : (
                              <>
                                <FileText className="mr-1 h-4 w-4" />
                                View
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-1">No materials found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || categoryFilter !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Add your first training material to get started"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Training Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <CardTitle>Upcoming Training Sessions</CardTitle>
                  <CardDescription>
                    Schedule of live training sessions and workshops
                  </CardDescription>
                </div>
                <Button className="mt-4 sm:mt-0">
                  <Calendar className="mr-2 h-4 w-4" />
                  Schedule Session
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingTrainingSessions.map((session) => (
                  <Card key={session.id} className="overflow-hidden">
                    <div className="h-2 bg-green-500"></div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-900">{session.title}</h3>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex">
                          <Calendar className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
                          <div>
                            <p className="text-sm font-medium">{session.date}</p>
                            <p className="text-xs text-gray-500">{session.time}</p>
                          </div>
                        </div>
                        <div className="flex">
                          <Users className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
                          <div>
                            <p className="text-sm font-medium">{session.instructor}</p>
                            <p className="text-xs text-gray-500">
                              {session.participants}/{session.capacity} participants
                            </p>
                          </div>
                        </div>
                        <div className="flex">
                          <MapPin className="h-4 w-4 text-gray-500 mt-0.5 mr-2" />
                          <p className="text-sm">{session.location}</p>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <div className="w-2/3 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.round(session.participants / session.capacity * 100)}%` }}
                          ></div>
                        </div>
                        <Button size="sm">
                          Register
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Add New Material Tab */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Training Material</CardTitle>
              <CardDescription>
                Create and publish new training content for the team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Material Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Social Media Best Practices" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="marketing">Marketing</SelectItem>
                              <SelectItem value="analytics">Analytics</SelectItem>
                              <SelectItem value="design">Design</SelectItem>
                              <SelectItem value="strategy">Strategy</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Content Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select content type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="document">Document</SelectItem>
                              <SelectItem value="video">Video</SelectItem>
                              <SelectItem value="course">Course</SelectItem>
                              <SelectItem value="workshop">Workshop</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="targetAudience"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Audience</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select target audience" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="new-employees">New Employees</SelectItem>
                              <SelectItem value="marketing-team">Marketing Team</SelectItem>
                              <SelectItem value="content-creators">Content Creators</SelectItem>
                              <SelectItem value="all-employees">All Employees</SelectItem>
                              <SelectItem value="management">Management</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="estimatedTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Estimated Completion Time</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select time" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="15 min">15 minutes</SelectItem>
                              <SelectItem value="30 min">30 minutes</SelectItem>
                              <SelectItem value="45 min">45 minutes</SelectItem>
                              <SelectItem value="1 hour">1 hour</SelectItem>
                              <SelectItem value="2 hours">2 hours</SelectItem>
                              <SelectItem value="3+ hours">3+ hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Author/Creator</FormLabel>
                          <FormControl>
                            <Input placeholder="Marketing Team" {...field} />
                          </FormControl>
                          <FormDescription>
                            Person or team who created this content
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Provide a detailed description of this training material..." 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="attachment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upload Content</FormLabel>
                        <FormControl>
                          <Input 
                            type="file"
                            onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)} 
                          />
                        </FormControl>
                        <FormDescription>
                          Upload documents, videos, or presentation files
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => form.reset()}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Publish Material</Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
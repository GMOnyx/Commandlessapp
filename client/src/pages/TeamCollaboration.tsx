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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  MessageSquare, 
  FileText, 
  Calendar,
  CheckCircle,
  PlusCircle,
  Clock,
  Bell,
  Search,
  Folder
} from "lucide-react";

// Form schema for creating new project
const projectSchema = z.object({
  name: z.string().min(3, "Project name must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  teamMembers: z.array(z.string()).min(1, "Select at least one team member"),
  dueDate: z.string().min(1, "Due date is required"),
  priority: z.string().min(1, "Priority is required"),
});

// Static data for demo purposes
const teamMembers = [
  {
    id: "user1",
    name: "Sarah Johnson",
    role: "Marketing Lead",
    email: "sarah@example.com",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  },
  {
    id: "user2",
    name: "Robert Davis",
    role: "Content Strategist",
    email: "robert@example.com",
    avatar: null
  },
  {
    id: "user3",
    name: "Jennifer Taylor",
    role: "Social Media Manager",
    email: "jennifer@example.com",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  },
  {
    id: "user4",
    name: "Michael Brown",
    role: "Graphic Designer",
    email: "michael@example.com",
    avatar: null
  },
  {
    id: "user5",
    name: "Emily Wilson",
    role: "Marketing Specialist",
    email: "emily@example.com",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
  }
];

const projects = [
  {
    id: 1,
    name: "Q3 Marketing Campaign",
    description: "Develop and launch the Q3 product marketing campaign across all channels",
    status: "in-progress",
    progress: 45,
    dueDate: "2023-09-15",
    priority: "high",
    teamMembers: ["user1", "user3", "user5"],
    tasks: [
      { id: 1, name: "Campaign strategy document", assigned: "user1", status: "completed", dueDate: "2023-07-10" },
      { id: 2, name: "Content creation", assigned: "user3", status: "in-progress", dueDate: "2023-08-05" },
      { id: 3, name: "Creative assets design", assigned: "user4", status: "in-progress", dueDate: "2023-08-15" },
      { id: 4, name: "Channel distribution plan", assigned: "user5", status: "not-started", dueDate: "2023-08-20" },
      { id: 5, name: "Campaign launch", assigned: "user1", status: "not-started", dueDate: "2023-09-01" }
    ]
  },
  {
    id: 2,
    name: "Website Redesign",
    description: "Update the marketing pages with new branding and improved user experience",
    status: "in-progress",
    progress: 30,
    dueDate: "2023-10-30",
    priority: "medium",
    teamMembers: ["user2", "user4"],
    tasks: [
      { id: 1, name: "Sitemap and wireframes", assigned: "user2", status: "completed", dueDate: "2023-07-15" },
      { id: 2, name: "Content revision", assigned: "user2", status: "in-progress", dueDate: "2023-08-10" },
      { id: 3, name: "Design mockups", assigned: "user4", status: "in-progress", dueDate: "2023-09-05" },
      { id: 4, name: "Development", assigned: "user4", status: "not-started", dueDate: "2023-10-10" },
      { id: 5, name: "Testing and launch", assigned: "user1", status: "not-started", dueDate: "2023-10-25" }
    ]
  },
  {
    id: 3,
    name: "New Employee Welcome Kit",
    description: "Create onboarding materials and welcome package for new marketing team members",
    status: "completed",
    progress: 100,
    dueDate: "2023-06-30",
    priority: "medium",
    teamMembers: ["user1", "user2", "user5"],
    tasks: [
      { id: 1, name: "Onboarding checklist", assigned: "user1", status: "completed", dueDate: "2023-06-05" },
      { id: 2, name: "Brand guidelines document", assigned: "user2", status: "completed", dueDate: "2023-06-10" },
      { id: 3, name: "Training materials", assigned: "user5", status: "completed", dueDate: "2023-06-20" },
      { id: 4, name: "Welcome package design", assigned: "user4", status: "completed", dueDate: "2023-06-25" }
    ]
  },
  {
    id: 4,
    name: "Customer Testimonial Series",
    description: "Interview customers and create testimonial content for social media",
    status: "not-started",
    progress: 0,
    dueDate: "2023-11-15",
    priority: "low",
    teamMembers: ["user3", "user5"],
    tasks: [
      { id: 1, name: "Customer selection", assigned: "user5", status: "not-started", dueDate: "2023-09-15" },
      { id: 2, name: "Interview questions", assigned: "user2", status: "not-started", dueDate: "2023-09-30" },
      { id: 3, name: "Conduct interviews", assigned: "user5", status: "not-started", dueDate: "2023-10-20" },
      { id: 4, name: "Content creation", assigned: "user3", status: "not-started", dueDate: "2023-11-05" }
    ]
  }
];

export default function TeamCollaboration() {
  const [activeTab, setActiveTab] = useState("projects");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { toast } = useToast();
  
  // Form for creating a new project
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      teamMembers: [],
      dueDate: "",
      priority: "",
    }
  });
  
  const onSubmit = (data: z.infer<typeof projectSchema>) => {
    // In a real app, this would create a new project
    toast({
      title: "Project created",
      description: `Created project "${data.name}"`,
    });
    form.reset();
    setActiveTab("projects");
  };
  
  // Filter projects by search term and status
  const filteredProjects = projects.filter((project) => {
    const matchesSearch = searchTerm
      ? project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase())
      : true;
      
    const matchesStatus = statusFilter === "all" ? true : project.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });
  
  // Get team member by ID
  const getTeamMember = (id: string) => {
    return teamMembers.find(member => member.id === id);
  };
  
  // Get task status badge color
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "not-started":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Get project status badge color
  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "not-started":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  // Get priority badge color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "low":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };
  
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Team Collaboration</h1>
      
      {/* Collaboration Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <Folder className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Projects</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {projects.filter(p => p.status !== "completed").length}
              </h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Completed Projects</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {projects.filter(p => p.status === "completed").length}
              </h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Team Members</p>
              <h3 className="text-2xl font-bold text-gray-900">{teamMembers.length}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-orange-100 p-3 rounded-full mr-4">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Upcoming Deadlines</p>
              <h3 className="text-2xl font-bold text-gray-900">3</h3>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="team">Team Members</TabsTrigger>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="new-project">New Project</TabsTrigger>
        </TabsList>
        
        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <CardTitle>Marketing Team Projects</CardTitle>
                  <CardDescription>
                    Manage and track all ongoing marketing projects
                  </CardDescription>
                </div>
                <Button 
                  className="mt-4 sm:mt-0"
                  onClick={() => setActiveTab("new-project")}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <div className="flex flex-col sm:flex-row gap-4 mb-4">
                  <div className="relative flex-grow">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="search"
                      placeholder="Search projects..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value)}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="not-started">Not Started</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {filteredProjects.length > 0 ? (
                <div className="space-y-4">
                  {filteredProjects.map((project) => (
                    <Card key={project.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 border-b border-gray-100">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start">
                            <div>
                              <h3 className="font-medium text-lg text-gray-900">{project.name}</h3>
                              <p className="text-sm text-gray-500 mt-1">{project.description}</p>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2 sm:mt-0">
                              <Badge className={getProjectStatusColor(project.status)}>
                                {project.status.split('-').map(word => 
                                  word.charAt(0).toUpperCase() + word.slice(1)
                                ).join(' ')}
                              </Badge>
                              <Badge className={getPriorityColor(project.priority)}>
                                {project.priority.charAt(0).toUpperCase() + project.priority.slice(1)} Priority
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="mt-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-medium">Progress</span>
                              <span className="text-sm text-gray-500">{project.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  project.status === 'completed' ? 'bg-green-500' : 'bg-blue-500'
                                }`} 
                                style={{ width: `${project.progress}%` }}
                              ></div>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex flex-wrap justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-500">Due Date</span>
                              <span className="text-sm font-medium flex items-center">
                                <Calendar className="mr-1 h-4 w-4 text-gray-400" />
                                {project.dueDate}
                              </span>
                            </div>
                            
                            <div className="flex flex-col items-end sm:items-start">
                              <span className="text-xs text-gray-500">Team</span>
                              <div className="flex -space-x-2 overflow-hidden">
                                {project.teamMembers.map((memberID) => {
                                  const member = getTeamMember(memberID);
                                  return member ? (
                                    <Avatar key={memberID} className="border-2 border-white">
                                      {member.avatar ? (
                                        <AvatarImage src={member.avatar} alt={member.name} />
                                      ) : (
                                        <AvatarFallback>
                                          {member.name.split(' ').map(n => n[0]).join('')}
                                        </AvatarFallback>
                                      )}
                                    </Avatar>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50">
                          <h4 className="text-sm font-medium text-gray-700 mb-2">Tasks</h4>
                          <ul className="space-y-1">
                            {project.tasks.slice(0, 3).map((task) => {
                              const assignedMember = getTeamMember(task.assigned);
                              return (
                                <li key={task.id} className="text-sm flex justify-between items-center">
                                  <div className="flex items-center">
                                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                                      task.status === 'completed' ? 'bg-green-500' :
                                      task.status === 'in-progress' ? 'bg-blue-500' : 'bg-gray-300'
                                    }`}></span>
                                    <span className={task.status === 'completed' ? 'line-through text-gray-500' : ''}>
                                      {task.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center">
                                    {assignedMember && (
                                      <span className="text-xs text-gray-500 mr-2">{assignedMember.name.split(' ')[0]}</span>
                                    )}
                                    <Badge variant="outline" className={getTaskStatusColor(task.status)}>
                                      {task.status.split('-').map(word => 
                                        word.charAt(0).toUpperCase() + word.slice(1)
                                      ).join(' ')}
                                    </Badge>
                                  </div>
                                </li>
                              );
                            })}
                            {project.tasks.length > 3 && (
                              <li className="text-xs text-center text-gray-500 mt-2">
                                + {project.tasks.length - 3} more tasks
                              </li>
                            )}
                          </ul>
                        </div>
                        
                        <div className="px-4 py-3 bg-white border-t border-gray-100 flex justify-end">
                          <Button size="sm" variant="outline">View Details</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Folder className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="font-medium text-gray-900 mb-1">No projects found</h3>
                  <p className="text-gray-500 mb-4">
                    {searchTerm || statusFilter !== "all" 
                      ? "Try adjusting your search or filters"
                      : "Create your first project to get started"}
                  </p>
                  {!(searchTerm || statusFilter !== "all") && (
                    <Button onClick={() => setActiveTab("new-project")}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Create Project
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Team Members Tab */}
        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>
                    View and manage marketing team members
                  </CardDescription>
                </div>
                <Button className="mt-4 sm:mt-0">
                  <Users className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {teamMembers.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10">
                          {member.avatar ? (
                            <AvatarImage src={member.avatar} alt={member.name} />
                          ) : (
                            <AvatarFallback>
                              {member.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="ml-4">
                          <h3 className="text-sm font-medium">{member.name}</h3>
                          <p className="text-xs text-gray-500">{member.role}</p>
                        </div>
                      </div>
                      
                      <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-2">
                        <div className="text-xs text-gray-500">{member.email}</div>
                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline">
                            <MessageSquare className="mr-1 h-4 w-4" />
                            Message
                          </Button>
                          <Button size="sm" variant="outline">
                            <FileText className="mr-1 h-4 w-4" />
                            Profile
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest updates and actions from the team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flow-root">
                <ul className="-mb-8">
                  {recentActivity.map((activity, activityIdx) => {
                    const user = getTeamMember(activity.user);
                    return (
                      <li key={activity.id}>
                        <div className="relative pb-8">
                          {activityIdx !== recentActivity.length - 1 ? (
                            <span 
                              className="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" 
                              aria-hidden="true"
                            ></span>
                          ) : null}
                          <div className="relative flex items-start space-x-3">
                            {user && (
                              <div className="relative">
                                <Avatar>
                                  {user.avatar ? (
                                    <AvatarImage src={user.avatar} alt={user.name} />
                                  ) : (
                                    <AvatarFallback>
                                      {user.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div>
                                <div className="text-sm">
                                  <span className="font-medium text-gray-900">
                                    {user?.name || 'Unknown User'}
                                  </span>
                                  {' '}
                                  <span className="text-gray-600">
                                    {activity.action}
                                  </span>
                                  {' '}
                                  <span className="font-medium text-gray-900">
                                    {activity.target}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-sm text-gray-500">
                                  in {activity.project} • {activity.timestamp}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-6 text-center">
                  <Button variant="outline">
                    <Bell className="mr-2 h-4 w-4" />
                    View All Activity
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* New Project Tab */}
        <TabsContent value="new-project" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
              <CardDescription>
                Set up a new project for the marketing team
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Q4 Marketing Campaign" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Describe the project goals and objectives..." 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="teamMembers"
                    render={() => (
                      <FormItem>
                        <FormLabel>Team Members</FormLabel>
                        <div className="space-y-2">
                          {teamMembers.map((member) => (
                            <div key={member.id} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={member.id}
                                value={member.id}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                onChange={(e) => {
                                  const currentValues = form.getValues("teamMembers") || [];
                                  const newValues = e.target.checked
                                    ? [...currentValues, member.id]
                                    : currentValues.filter(value => value !== member.id);
                                  form.setValue("teamMembers", newValues, { shouldValidate: true });
                                }}
                              />
                              <label htmlFor={member.id} className="text-sm font-medium text-gray-700 flex items-center">
                                <Avatar className="h-6 w-6 mr-2">
                                  {member.avatar ? (
                                    <AvatarImage src={member.avatar} alt={member.name} />
                                  ) : (
                                    <AvatarFallback>
                                      {member.name.split(' ').map(n => n[0]).join('')}
                                    </AvatarFallback>
                                  )}
                                </Avatar>
                                {member.name} ({member.role})
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        form.reset();
                        setActiveTab("projects");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">Create Project</Button>
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
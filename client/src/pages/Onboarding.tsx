import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
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
import { 
  UserPlus, 
  CalendarCheck, 
  FileText, 
  CheckCircle,
  Clock,
  BookOpen,
  Users
} from "lucide-react";

// Form schema for creating new employee onboarding
const onboardingSchema = z.object({
  employeeName: z.string().min(3, "Employee name must be at least 3 characters"),
  employeeEmail: z.string().email("Please enter a valid email address"),
  position: z.string().min(2, "Position must be at least 2 characters"),
  department: z.string().min(2, "Department must be at least 2 characters"),
  startDate: z.string().min(1, "Start date is required"),
  mentorName: z.string().optional(),
  notes: z.string().optional(),
});

// Static data for demo purposes
const onboardingEmployees = [
  {
    id: 1,
    name: "Jane Smith",
    email: "jane.smith@example.com", 
    position: "Marketing Specialist",
    department: "Marketing",
    startDate: "2023-06-15",
    status: "active",
    completedTasks: 8,
    totalTasks: 12
  },
  {
    id: 2,
    name: "Michael Johnson",
    email: "michael.johnson@example.com", 
    position: "Content Creator",
    department: "Marketing",
    startDate: "2023-07-10",
    status: "active",
    completedTasks: 5,
    totalTasks: 12
  },
  {
    id: 3,
    name: "Emily Davis",
    email: "emily.davis@example.com", 
    position: "Graphic Designer",
    department: "Marketing",
    startDate: "2023-08-01",
    status: "pending",
    completedTasks: 0,
    totalTasks: 12
  }
];

const onboardingTasks = [
  { id: 1, name: "Complete HR paperwork", category: "administrative", dueDate: "Day 1" },
  { id: 2, name: "Setup company email", category: "technical", dueDate: "Day 1" },
  { id: 3, name: "Team introduction meeting", category: "social", dueDate: "Week 1" },
  { id: 4, name: "Marketing tools training", category: "training", dueDate: "Week 1" },
  { id: 5, name: "Brand guidelines review", category: "training", dueDate: "Week 1" },
  { id: 6, name: "Project management system training", category: "technical", dueDate: "Week 2" },
  { id: 7, name: "Marketing strategy overview", category: "training", dueDate: "Week 2" },
  { id: 8, name: "Client communication protocols", category: "training", dueDate: "Week 2" },
  { id: 9, name: "First project assignment", category: "work", dueDate: "Week 3" },
  { id: 10, name: "30-day check-in with manager", category: "feedback", dueDate: "Day 30" },
  { id: 11, name: "Department process training", category: "training", dueDate: "Week 4" },
  { id: 12, name: "60-day performance review", category: "feedback", dueDate: "Day 60" }
];

export default function Onboarding() {
  const [activeTab, setActiveTab] = useState("overview");
  const { toast } = useToast();
  
  // Form for adding a new employee to onboarding
  const form = useForm<z.infer<typeof onboardingSchema>>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      employeeName: "",
      employeeEmail: "",
      position: "",
      department: "",
      startDate: "",
      mentorName: "",
      notes: ""
    }
  });
  
  const onSubmit = (data: z.infer<typeof onboardingSchema>) => {
    // In a real app, this would create a new onboarding record
    toast({
      title: "Employee onboarding created",
      description: `Onboarding process started for ${data.employeeName}`,
    });
    form.reset();
  };
  
  // Calculate onboarding statistics
  const totalEmployees = onboardingEmployees.length;
  const activeOnboarding = onboardingEmployees.filter(e => e.status === "active").length;
  const averageCompletion = Math.round(
    onboardingEmployees.reduce((acc, curr) => acc + (curr.completedTasks / curr.totalTasks * 100), 0) / totalEmployees
  );
  
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Employee Onboarding</h1>
      
      {/* Onboarding Statistics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-blue-100 p-3 rounded-full mr-4">
              <UserPlus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total Employees</p>
              <h3 className="text-2xl font-bold text-gray-900">{totalEmployees}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-green-100 p-3 rounded-full mr-4">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Onboardings</p>
              <h3 className="text-2xl font-bold text-gray-900">{activeOnboarding}</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-purple-100 p-3 rounded-full mr-4">
              <CheckCircle className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Avg. Completion</p>
              <h3 className="text-2xl font-bold text-gray-900">{averageCompletion}%</h3>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="flex flex-row items-center pt-6">
            <div className="bg-orange-100 p-3 rounded-full mr-4">
              <CalendarCheck className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Next Starting</p>
              <h3 className="text-2xl font-bold text-gray-900">Aug 1</h3>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="checklist">Onboarding Checklist</TabsTrigger>
          <TabsTrigger value="new">Add New Employee</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Program Overview</CardTitle>
              <CardDescription>
                Your marketing team's employee onboarding process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-medium text-blue-700 flex items-center mb-2">
                      <FileText className="h-5 w-5 mr-2" />
                      Week 1: Orientation
                    </h3>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Company and team introductions</li>
                      <li>• Basic system access and setup</li>
                      <li>• HR documentation and benefits</li>
                      <li>• Brand guidelines overview</li>
                    </ul>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="font-medium text-green-700 flex items-center mb-2">
                      <BookOpen className="h-5 w-5 mr-2" />
                      Week 2-3: Tools & Systems
                    </h3>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Marketing platform training</li>
                      <li>• Project management system</li>
                      <li>• Communication channels setup</li>
                      <li>• First small project assignment</li>
                    </ul>
                  </div>
                  
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h3 className="font-medium text-purple-700 flex items-center mb-2">
                      <Users className="h-5 w-5 mr-2" />
                      Month 1-2: Integration
                    </h3>
                    <ul className="text-sm space-y-1 text-gray-700">
                      <li>• Full project responsibilities</li>
                      <li>• Team collaboration processes</li>
                      <li>• Regular feedback sessions</li>
                      <li>• 60-day performance check-in</li>
                    </ul>
                  </div>
                </div>
                
                <div className="mt-6">
                  <h3 className="font-medium text-gray-900 mb-2">Upcoming Onboarding Activities</h3>
                  <div className="bg-white border rounded-lg">
                    <ul className="divide-y divide-gray-200">
                      <li className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Michael Johnson - Marketing tools training</p>
                          <p className="text-xs text-gray-500">Assigned to: Sarah Williams</p>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">Tomorrow</span>
                      </li>
                      <li className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Michael Johnson - Brand guidelines review</p>
                          <p className="text-xs text-gray-500">Assigned to: Robert Davis</p>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Friday</span>
                      </li>
                      <li className="px-4 py-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">Emily Davis - New employee orientation</p>
                          <p className="text-xs text-gray-500">Assigned to: HR Department</p>
                        </div>
                        <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Next week</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Employees in Onboarding</CardTitle>
              <CardDescription>
                Track progress and manage employees currently in the onboarding process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Position</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Department</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Start Date</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Progress</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onboardingEmployees.map(employee => (
                      <tr key={employee.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">{employee.name}</td>
                        <td className="px-4 py-3 text-sm">{employee.position}</td>
                        <td className="px-4 py-3 text-sm">{employee.department}</td>
                        <td className="px-4 py-3 text-sm">{employee.startDate}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            employee.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {employee.status === 'active' ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className="bg-blue-600 h-2.5 rounded-full" 
                              style={{ width: `${Math.round(employee.completedTasks / employee.totalTasks * 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-500">
                            {employee.completedTasks}/{employee.totalTasks} tasks
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <Button variant="outline" size="sm">View Details</Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Marketing Team Onboarding Checklist</CardTitle>
              <CardDescription>
                Standardized tasks that each new employee must complete during onboarding
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="bg-blue-50 border-blue-200 text-blue-700">All Tasks</Button>
                  <Button variant="outline" size="sm">Administrative</Button>
                  <Button variant="outline" size="sm">Technical</Button>
                  <Button variant="outline" size="sm">Training</Button>
                  <Button variant="outline" size="sm">Social</Button>
                  <Button variant="outline" size="sm">Work</Button>
                  <Button variant="outline" size="sm">Feedback</Button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">#</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Task Name</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Category</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Due</th>
                        <th className="px-4 py-2 text-left text-sm font-medium text-gray-500">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {onboardingTasks.map(task => (
                        <tr key={task.id} className="border-b hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{task.id}</td>
                          <td className="px-4 py-3 text-sm font-medium">{task.name}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              task.category === 'administrative' ? 'bg-gray-100 text-gray-800' :
                              task.category === 'technical' ? 'bg-blue-100 text-blue-800' :
                              task.category === 'training' ? 'bg-purple-100 text-purple-800' :
                              task.category === 'social' ? 'bg-green-100 text-green-800' :
                              task.category === 'work' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-orange-100 text-orange-800'
                            }`}>
                              {task.category}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">{task.dueDate}</td>
                          <td className="px-4 py-3 text-sm">
                            <Button variant="outline" size="sm">Edit</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex justify-end">
                  <Button variant="outline" className="mr-2">
                    <FileText className="mr-2 h-4 w-4" />
                    Export Checklist
                  </Button>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Add New Employee Tab */}
        <TabsContent value="new" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New Employee to Onboarding</CardTitle>
              <CardDescription>
                Start the onboarding process for a new marketing team member
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="employeeName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Employee Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Jane Smith" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="employeeEmail"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email Address</FormLabel>
                          <FormControl>
                            <Input placeholder="jane.smith@company.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Position</FormLabel>
                          <FormControl>
                            <Input placeholder="Marketing Specialist" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="department"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Department</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a department" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="marketing">Marketing</SelectItem>
                              <SelectItem value="sales">Sales</SelectItem>
                              <SelectItem value="product">Product</SelectItem>
                              <SelectItem value="engineering">Engineering</SelectItem>
                              <SelectItem value="hr">HR</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="mentorName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assigned Mentor (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a mentor" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="sarah.williams">Sarah Williams</SelectItem>
                              <SelectItem value="robert.davis">Robert Davis</SelectItem>
                              <SelectItem value="jennifer.taylor">Jennifer Taylor</SelectItem>
                              <SelectItem value="david.miller">David Miller</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription>
                            The mentor will guide the employee through the onboarding process
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any special considerations or customizations for this employee's onboarding..." 
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
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
                    <Button type="submit">Create Onboarding Plan</Button>
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
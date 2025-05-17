import { useQuery } from "@tanstack/react-query";
import { Activity } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";
import { 
  BotIcon, 
  Edit3Icon, 
  AlertTriangleIcon 
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityFeed() {
  const { data: activities, isLoading, error } = useQuery<Activity[]>({
    queryKey: ["/api/activities"],
  });
  
  if (isLoading) {
    return (
      <div className="flow-root">
        <ul className="-mb-8">
          {[1, 2, 3].map((i) => (
            <li key={i}>
              <div className="relative pb-8">
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
                <div className="relative flex space-x-3">
                  <div>
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <Skeleton className="h-4 w-64" />
                    </div>
                    <div>
                      <Skeleton className="h-4 w-16" />
                    </div>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  
  if (error || !activities) {
    return (
      <div className="text-center py-4 text-gray-500">
        Failed to load activity data
      </div>
    );
  }
  
  // If there are no activities yet
  if (activities.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No recent activities
      </div>
    );
  }
  
  const getActivityIcon = (activity: Activity) => {
    switch (activity.activityType) {
      case "command_used":
        return (
          <span className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center ring-8 ring-white">
            <BotIcon className="h-4 w-4 text-white" />
          </span>
        );
      case "command_created":
        return (
          <span className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center ring-8 ring-white">
            <Edit3Icon className="h-4 w-4 text-white" />
          </span>
        );
      case "bot_connected":
      case "bot_disconnected":
      case "bot_created":
        return (
          <span className="h-8 w-8 rounded-full bg-red-500 flex items-center justify-center ring-8 ring-white">
            <AlertTriangleIcon className="h-4 w-4 text-white" />
          </span>
        );
      default:
        return (
          <span className="h-8 w-8 rounded-full bg-gray-500 flex items-center justify-center ring-8 ring-white">
            <BotIcon className="h-4 w-4 text-white" />
          </span>
        );
    }
  };
  
  const formatActivityTime = (date: Date | string | null) => {
    if (!date) return "Unknown time";
    
    const activityDate = typeof date === "string" ? new Date(date) : date;
    return formatDistanceToNow(activityDate, { addSuffix: true });
  };
  
  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {activityIdx !== activities.length - 1 ? (
                <span className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
              ) : null}
              <div className="relative flex space-x-3">
                <div>
                  {getActivityIcon(activity)}
                </div>
                <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                  <div>
                    <p className="text-sm text-gray-800">
                      {activity.description}
                    </p>
                  </div>
                  <div className="text-right text-sm whitespace-nowrap text-gray-500">
                    <time dateTime={activity.createdAt?.toString()}>
                      {formatActivityTime(activity.createdAt)}
                    </time>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

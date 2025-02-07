"use client"

import * as React from "react"
import { TrendingUp } from "lucide-react"
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { format } from "date-fns"

import { cn } from "../../../../../lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../card/card"

interface AnalyticsChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: number[];
  title: string;
  description: string;
  trendingValue: string;
  chartColor?: "blue" | "green" | "red" | "yellow";
  className?: string;
}

const gradientColors = {
  blue: {
    start: "#60A5FA",
    end: "rgba(96, 165, 250, 0)",
    stroke: "#3B82F6"
  },
  green: {
    start: "#34D399",
    end: "rgba(52, 211, 153, 0)",
    stroke: "#10B981"
  },
  red: {
    start: "#F87171",
    end: "rgba(248, 113, 113, 0)",
    stroke: "#EF4444"
  },
  yellow: {
    start: "#FBBF24",
    end: "rgba(251, 191, 36, 0)",
    stroke: "#F59E0B"
  }
} as const

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload?.length > 0 && payload[0]?.value != null) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-2xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Time
            </span>
            <span className="font-bold text-muted-foreground">
              {format(new Date(), "HH:mm:ss")}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[0.70rem] uppercase text-muted-foreground">
              Value
            </span>
            <span className="font-bold">
              {payload[0].value.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

export function AnalyticsChart({
  data,
  title,
  description,
  trendingValue,
  chartColor = "blue",
  className,
  ...props
}: AnalyticsChartProps) {
  const gradientId = `gradient-${title.toLowerCase().replace(/\s+/g, '-')}`
  const colors = gradientColors[chartColor]

  // Convert the array of numbers to chart data format with timestamps
  const chartData = data.map((value, index) => {
    const timestamp = new Date();
    // Subtract time for each point to create a timeline
    timestamp.setSeconds(timestamp.getSeconds() - (data.length - 1 - index));
    return {
      value,
      timestamp: timestamp.getTime()
    };
  });

  return (
    <Card className={cn("", className)} {...props}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="text-xl font-bold" style={{ color: colors.stroke }}>{trendingValue}</div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.start} stopOpacity={0.5} />
                <stop offset="100%" stopColor={colors.end} stopOpacity={0.5} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3"
              vertical={false}
              className="stroke-muted"
            />
            <XAxis
              dataKey="timestamp"
              tickFormatter={(value) => format(value, "HH:mm:ss")}
              minTickGap={30}
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              className="text-muted-foreground"
              width={40}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              stroke={colors.stroke}
              fill={`url(#${gradientId})`}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
      <CardFooter>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TrendingUp className="h-4 w-4" />
          <span>Last updated: {format(new Date(), "HH:mm:ss")}</span>
        </div>
      </CardFooter>
    </Card>
  )
} 
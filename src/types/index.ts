export type DatasetStatus = 'ready' | 'processing' | 'error'

export interface Dataset {
  id: string
  name: string
  rows: number
  columns: number
  quality_score: number
  status: DatasetStatus
  file_type: string
  created_at: string
  size_bytes: number
}

export interface Metric {
  label: string
  value: string
  change?: string
  trend?: 'up' | 'down' | 'neutral'
  color?: string
}

export interface ChartPoint {
  label: string
  value: number
  secondary?: number
}

export interface ChartData {
  title: string
  kind: 'line' | 'bar' | 'area' | 'pie' | 'scatter' | 'histogram' | 'radar'
  x_label: string
  y_label: string
  points: ChartPoint[]
}

export interface Insight {
  id: string
  severity: 'positive' | 'warning' | 'critical' | 'info'
  title: string
  description: string
  metric?: string
}

export interface Profile {
  numeric_columns: string[]
  categorical_columns: string[]
  date_columns: string[]
  columns: Array<{ name: string; type: string; nulls: number; unique: number }>
}

export interface Quality {
  score: number
  missing_values: number
  duplicate_rows: number
  outliers: number
  recommendations: string[]
}

export interface DatasetAnalysis {
  dataset: Dataset
  metrics: Metric[]
  charts: ChartData[]
  insights: Insight[]
  profile: Profile
  quality: Quality
}

export interface Report {
  id: string
  name: string
  dataset_id: string
  dataset_name: string
  type: string
  status: 'ready' | 'processing' | 'error'
  created_at: string
  summary: string
  analysis: DatasetAnalysis
}

{{/*
External Metrics Web Service - Helm Template Helpers
Reusable template functions for consistent resource naming and labeling
*/}}

{{/*
Expand the name of the chart.
*/}}
{{- define "monitoring-web-service.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "monitoring-web-service.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "monitoring-web-service.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "monitoring-web-service.labels" -}}
helm.sh/chart: {{ include "monitoring-web-service.chart" . }}
{{ include "monitoring-web-service.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: backend
app.kubernetes.io/part-of: monitoring-platform
{{- end }}

{{/*
Selector labels
*/}}
{{- define "monitoring-web-service.selectorLabels" -}}
app.kubernetes.io/name: {{ include "monitoring-web-service.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "monitoring-web-service.serviceAccountName" -}}
{{- if .Values.rbac.create }}
{{- default (include "monitoring-web-service.fullname" .) .Values.rbac.serviceAccountName }}
{{- else }}
{{- default "default" .Values.rbac.serviceAccountName }}
{{- end }}
{{- end }}

{{/*
Create the Docker image reference
*/}}
{{- define "monitoring-web-service.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.app.image.registry -}}
{{- $repository := .Values.app.image.repository -}}
{{- $tag := .Values.app.image.tag | default .Chart.AppVersion -}}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
PostgreSQL fullname
*/}}
{{- define "monitoring-web-service.postgresql.fullname" -}}
{{- if .Values.postgresql.fullnameOverride }}
{{- .Values.postgresql.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "postgresql" .Values.postgresql.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
PostgreSQL secret name
*/}}
{{- define "monitoring-web-service.postgresql.secretName" -}}
{{- if .Values.postgresql.auth.existingSecret }}
{{- printf "%s" .Values.postgresql.auth.existingSecret }}
{{- else }}
{{- printf "%s" (include "monitoring-web-service.postgresql.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Redis fullname
*/}}
{{- define "monitoring-web-service.redis.fullname" -}}
{{- if .Values.redis.fullnameOverride }}
{{- .Values.redis.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "redis" .Values.redis.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Redis secret name
*/}}
{{- define "monitoring-web-service.redis.secretName" -}}
{{- if .Values.redis.auth.existingSecret }}
{{- printf "%s" .Values.redis.auth.existingSecret }}
{{- else }}
{{- printf "%s" (include "monitoring-web-service.redis.fullname" .) }}
{{- end }}
{{- end }}

{{/*
Environment-specific values merger
This function merges environment-specific values with base values
*/}}
{{- define "monitoring-web-service.mergeEnvValues" -}}
{{- $environment := .Values.global.environment | default "production" }}
{{- $envValues := index .Values.environments $environment }}
{{- if $envValues }}
{{- $merged := deepCopy .Values | mustMergeOverwrite (deepCopy $envValues) }}
{{- toYaml $merged }}
{{- else }}
{{- toYaml .Values }}
{{- end }}
{{- end }}

{{/*
Generate database password
*/}}
{{- define "monitoring-web-service.secretPassword" -}}
{{- if . -}}
{{- . -}}
{{- else -}}
{{- randAlphaNum 32 -}}
{{- end -}}
{{- end }}

{{/*
Return the proper Storage Class
*/}}
{{- define "monitoring-web-service.storageClass" -}}
{{- include "common.storage.class" (dict "persistence" .Values.persistence "global" .Values.global) -}}
{{- end }}

{{/*
Compile all warnings into a single message, and call fail.
*/}}
{{- define "monitoring-web-service.validateValues" -}}
{{- $messages := list -}}
{{- $messages := without $messages "" -}}
{{- $message := join "\n" $messages -}}

{{- if $message -}}
{{-   printf "\nVALUES VALIDATION:\n%s" $message | fail -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for HorizontalPodAutoscaler
*/}}
{{- define "monitoring-web-service.hpa.apiVersion" -}}
{{- if .Capabilities.APIVersions.Has "autoscaling/v2" -}}
{{- print "autoscaling/v2" -}}
{{- else -}}
{{- print "autoscaling/v2beta2" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for PodDisruptionBudget
*/}}
{{- define "monitoring-web-service.pdb.apiVersion" -}}
{{- if .Capabilities.APIVersions.Has "policy/v1" -}}
{{- print "policy/v1" -}}
{{- else -}}
{{- print "policy/v1beta1" -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for NetworkPolicy
*/}}
{{- define "monitoring-web-service.networkPolicy.apiVersion" -}}
{{- if .Capabilities.APIVersions.Has "networking.k8s.io/v1" -}}
{{- print "networking.k8s.io/v1" -}}
{{- else -}}
{{- print "networking.k8s.io/v1beta1" -}}
{{- end -}}
{{- end }}

{{/*
Get the PostgreSQL exporter image
*/}}
{{- define "monitoring-web-service.postgresql.exporter.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.monitoring.postgresql.exporter.image.registry -}}
{{- $repository := .Values.monitoring.postgresql.exporter.image.repository -}}
{{- $tag := .Values.monitoring.postgresql.exporter.image.tag -}}
{{- if $registry }}
{{- printf "%s/%s:%s" $registry $repository $tag }}
{{- else }}
{{- printf "%s:%s" $repository $tag }}
{{- end }}
{{- end }}

{{/*
Create a default monitoring namespace
*/}}
{{- define "monitoring-web-service.monitoring.namespace" -}}
{{- if .Values.serviceMonitor.namespace }}
{{- .Values.serviceMonitor.namespace }}
{{- else }}
{{- .Release.Namespace }}
{{- end }}
{{- end }}
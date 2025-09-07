{{/*
Expand the name of the chart.
*/}}
{{- define "chart.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "chart.fullname" -}}
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
{{- define "chart.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "chart.labels" -}}
helm.sh/chart: {{ include "chart.chart" . }}
{{ include "chart.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: {{ include "chart.name" . }}
{{- if .Values.app.tier }}
app.kubernetes.io/tier: {{ .Values.app.tier }}
{{- end }}
{{- if .Values.app.component }}
app.kubernetes.io/component: {{ .Values.app.component }}
{{- end }}
{{- if .Values.commonLabels }}
{{ toYaml .Values.commonLabels }}
{{- end }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "chart.selectorLabels" -}}
app.kubernetes.io/name: {{ include "chart.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "chart.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "chart.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Create a default image name.
*/}}
{{- define "chart.image" -}}
{{- $registry := .Values.global.imageRegistry | default .Values.image.registry -}}
{{- $repository := .Values.image.repository -}}
{{- $tag := .Values.image.tag | default .Chart.AppVersion -}}
{{- if $registry -}}
{{ printf "%s/%s:%s" $registry $repository $tag }}
{{- else -}}
{{ printf "%s:%s" $repository $tag }}
{{- end -}}
{{- end }}

{{/*
Generate image pull secrets
*/}}
{{- define "chart.imagePullSecrets" -}}
{{- $pullSecrets := list }}
{{- if .Values.global.imagePullSecrets }}
{{- $pullSecrets = .Values.global.imagePullSecrets }}
{{- end }}
{{- if .Values.imagePullSecrets }}
{{- $pullSecrets = concat $pullSecrets .Values.imagePullSecrets }}
{{- end }}
{{- if $pullSecrets }}
imagePullSecrets:
{{- range $pullSecrets }}
  - name: {{ . }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create common annotations
*/}}
{{- define "chart.annotations" -}}
{{- if .Values.commonAnnotations }}
{{ toYaml .Values.commonAnnotations }}
{{- end }}
{{- end }}

{{/*
Create pod annotations
*/}}
{{- define "chart.podAnnotations" -}}
{{- if .Values.podAnnotations }}
{{ toYaml .Values.podAnnotations }}
{{- end }}
{{- if .Values.commonAnnotations }}
{{ toYaml .Values.commonAnnotations }}
{{- end }}
{{- end }}

{{/*
Create security context
*/}}
{{- define "chart.securityContext" -}}
{{- if .Values.securityContext }}
{{ toYaml .Values.securityContext }}
{{- else }}
allowPrivilegeEscalation: false
runAsNonRoot: true
runAsUser: 65534
readOnlyRootFilesystem: true
capabilities:
  drop:
  - ALL
{{- end }}
{{- end }}

{{/*
Create pod security context
*/}}
{{- define "chart.podSecurityContext" -}}
{{- if .Values.podSecurityContext }}
{{ toYaml .Values.podSecurityContext }}
{{- else }}
runAsNonRoot: true
runAsUser: 65534
runAsGroup: 65534
fsGroup: 65534
seccompProfile:
  type: RuntimeDefault
{{- end }}
{{- end }}

{{/*
Create container port configuration
*/}}
{{- define "chart.containerPorts" -}}
- name: http
  containerPort: {{ .Values.service.targetPort | default 8080 }}
  protocol: {{ .Values.service.protocol | default "TCP" }}
{{- if .Values.extraPorts }}
{{- range .Values.extraPorts }}
- name: {{ .name }}
  containerPort: {{ .containerPort }}
  protocol: {{ .protocol | default "TCP" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create volume mounts
*/}}
{{- define "chart.volumeMounts" -}}
{{- if .Values.volumeMounts }}
{{ toYaml .Values.volumeMounts }}
{{- end }}
{{- if .Values.persistence.enabled }}
- name: {{ include "chart.fullname" . }}-data
  mountPath: {{ .Values.persistence.mountPath | default "/data" }}
{{- end }}
{{- end }}

{{/*
Create volumes
*/}}
{{- define "chart.volumes" -}}
{{- if .Values.volumes }}
{{ toYaml .Values.volumes }}
{{- end }}
{{- if and .Values.persistence.enabled (not .Values.persistence.existingClaim) }}
- name: {{ include "chart.fullname" . }}-data
  persistentVolumeClaim:
    claimName: {{ include "chart.fullname" . }}-pvc
{{- else if and .Values.persistence.enabled .Values.persistence.existingClaim }}
- name: {{ include "chart.fullname" . }}-data
  persistentVolumeClaim:
    claimName: {{ .Values.persistence.existingClaim }}
{{- end }}
{{- end }}

{{/*
Create environment variables
*/}}
{{- define "chart.env" -}}
{{- if .Values.env }}
{{ toYaml .Values.env }}
{{- end }}
{{- end }}

{{/*
Create environment variables from ConfigMaps and Secrets
*/}}
{{- define "chart.envFrom" -}}
{{- if .Values.envFrom }}
{{ toYaml .Values.envFrom }}
{{- end }}
{{- if .Values.configMap.enabled }}
- configMapRef:
    name: {{ include "chart.fullname" . }}-config
{{- end }}
{{- if .Values.secret.enabled }}
- secretRef:
    name: {{ include "chart.fullname" . }}-secret
{{- end }}
{{- end }}

{{/*
Create resource requirements
*/}}
{{- define "chart.resources" -}}
{{- if .Values.resources }}
{{ toYaml .Values.resources }}
{{- else }}
limits:
  cpu: 500m
  memory: 512Mi
requests:
  cpu: 100m
  memory: 128Mi
{{- end }}
{{- end }}

{{/*
Create liveness probe
*/}}
{{- define "chart.livenessProbe" -}}
{{- if .Values.livenessProbe }}
{{ toYaml .Values.livenessProbe }}
{{- else }}
httpGet:
  path: /healthz
  port: http
  scheme: HTTP
initialDelaySeconds: 30
periodSeconds: 10
timeoutSeconds: 5
successThreshold: 1
failureThreshold: 3
{{- end }}
{{- end }}

{{/*
Create readiness probe
*/}}
{{- define "chart.readinessProbe" -}}
{{- if .Values.readinessProbe }}
{{ toYaml .Values.readinessProbe }}
{{- else }}
httpGet:
  path: /ready
  port: http
  scheme: HTTP
initialDelaySeconds: 5
periodSeconds: 10
timeoutSeconds: 5
successThreshold: 1
failureThreshold: 3
{{- end }}
{{- end }}

{{/*
Create startup probe (if enabled)
*/}}
{{- define "chart.startupProbe" -}}
{{- if and .Values.startupProbe .Values.startupProbe.enabled }}
httpGet:
  path: {{ .Values.startupProbe.httpGet.path | default "/startup" }}
  port: {{ .Values.startupProbe.httpGet.port | default "http" }}
  scheme: {{ .Values.startupProbe.httpGet.scheme | default "HTTP" }}
initialDelaySeconds: {{ .Values.startupProbe.initialDelaySeconds | default 10 }}
periodSeconds: {{ .Values.startupProbe.periodSeconds | default 10 }}
timeoutSeconds: {{ .Values.startupProbe.timeoutSeconds | default 5 }}
successThreshold: {{ .Values.startupProbe.successThreshold | default 1 }}
failureThreshold: {{ .Values.startupProbe.failureThreshold | default 30 }}
{{- end }}
{{- end }}

{{/*
Create node selector
*/}}
{{- define "chart.nodeSelector" -}}
{{- if .Values.nodeSelector }}
{{ toYaml .Values.nodeSelector }}
{{- end }}
{{- end }}

{{/*
Create tolerations
*/}}
{{- define "chart.tolerations" -}}
{{- if .Values.tolerations }}
{{ toYaml .Values.tolerations }}
{{- end }}
{{- end }}

{{/*
Create affinity rules
*/}}
{{- define "chart.affinity" -}}
{{- if .Values.affinity }}
{{ toYaml .Values.affinity }}
{{- end }}
{{- end }}

{{/*
Validate required values
*/}}
{{- define "chart.validateValues" -}}
{{- if not .Values.image.repository }}
{{- fail "image.repository is required" }}
{{- end }}
{{- if and .Values.ingress.enabled (not .Values.ingress.hosts) }}
{{- fail "ingress.hosts is required when ingress is enabled" }}
{{- end }}
{{- if and .Values.autoscaling.enabled (.Values.replicaCount) }}
{{- if gt (.Values.replicaCount | int) (.Values.autoscaling.maxReplicas | int) }}
{{- fail "replicaCount cannot be greater than autoscaling.maxReplicas when autoscaling is enabled" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create storage class name
*/}}
{{- define "chart.storageClassName" -}}
{{- $storageClass := .Values.persistence.storageClass | default .Values.global.storageClass -}}
{{- if $storageClass }}
storageClassName: {{ $storageClass }}
{{- end }}
{{- end }}

{{/*
Generate certificates for TLS
*/}}
{{- define "chart.gen-certs" -}}
{{- $altNames := list ( printf "%s.%s" (include "chart.fullname" .) .Release.Namespace ) ( printf "%s.%s.svc" (include "chart.fullname" .) .Release.Namespace ) -}}
{{- $ca := genCA "chart-ca" 365 -}}
{{- $cert := genSignedCert ( include "chart.fullname" . ) nil $altNames 365 $ca -}}
tls.crt: {{ $cert.Cert | b64enc }}
tls.key: {{ $cert.Key | b64enc }}
{{- end }}

{{/*
Return the target Kubernetes version
*/}}
{{- define "chart.kubeVersion" -}}
{{- if .Values.kubeVersion -}}
{{- .Values.kubeVersion -}}
{{- else -}}
{{- .Capabilities.KubeVersion.Version -}}
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for deployment
*/}}
{{- define "chart.deployment.apiVersion" -}}
{{- if semverCompare ">=1.14-0" (include "chart.kubeVersion" .) -}}
apps/v1
{{- else -}}
extensions/v1beta1
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for ingress
*/}}
{{- define "chart.ingress.apiVersion" -}}
{{- if semverCompare ">=1.19-0" (include "chart.kubeVersion" .) -}}
networking.k8s.io/v1
{{- else if semverCompare ">=1.14-0" (include "chart.kubeVersion" .) -}}
networking.k8s.io/v1beta1
{{- else -}}
extensions/v1beta1
{{- end -}}
{{- end }}

{{/*
Return the appropriate apiVersion for PodDisruptionBudget
*/}}
{{- define "chart.pdb.apiVersion" -}}
{{- if semverCompare ">=1.21-0" (include "chart.kubeVersion" .) -}}
policy/v1
{{- else -}}
policy/v1beta1
{{- end -}}
{{- end }}
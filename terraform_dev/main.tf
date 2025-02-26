terraform {
  required_version = ">= 1.5.0"

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.19.0"
      # version = "~> 3.108"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = "56253cd5-a450-495e-8137-d0a5195d5bb0"
}



locals {
  # Resource Group settings
  resource_group_name = "IAC-TPX-IMPACTAI-DEV-TFTEST"
  location            = "UK South"
  prefix    = "impactaidev"

  # Network settings
  vnet_address_space = ["10.0.0.0/16"]
  subnet_prefixes    = ["10.0.0.0/28"]


  # BGP Settings
  bgp_asn             = 65515
  bgp_peering_address = "10.0.1.30"
  bgp_peer_weight     = 0



  # Storage Account settings
  storage_account_name     = "${local.prefix}storage"
  account_tier             = "Standard"
  account_replication_type = "LRS"
  min_tls_version          = "TLS1_2"

  # Cosmos DB settings
  cosmos_account_name              = "${local.prefix}-cosmosdb-chathistory"
  cosmos_offer_type                = "Standard"
  cosmos_enable_automatic_failover = true
  cosmos_kind                      = "GlobalDocumentDB"
  cosmos_consistency_level         = "Session"
  cosmos_db_location               = "UK South"
  cosmos_db_consistency_policy = {
    default_consistency_level = "Session"
    max_interval_in_seconds   = 5
    max_staleness_prefix      = 100
  }
  cosmos_db_geo_redundant_backup = {
    backup_interval_in_minutes         = 240
    backup_retention_interval_in_hours = 8
    backup_storage_redundancy          = "Geo"
  }
  cosmos_bkp_type                         = "Periodic"
  cosmos_sql_db_name                      = "db_conversation_history"
  cosmos_sql_conversations_container_name = "conversations"
  cosmos_sql_logs_container_name          = "logs"
  cosmos_sql_metadata_container_name      = "document_metadata"

  # Search Service settings
  search_service_name          = "${local.prefix}-search"
  search_location              = "UK West"
  search_sku                   = "standard"
  search_replica_count         = 1
  search_partition_count       = 1
  search_hosting_mode          = "default"
  search_public_network_access = false # Change from current env, private endpoint only.
  search_top_k                 = 5
  search_strictness            = 3
  search_index_name            = "documentindex"

  # Web App
  sku = "B2"
  os_type = "Linux"
  app_auth_enabled     = false
  webapp_name          = "${local.prefix}-webapp"
  always_on            = false
  https_only           = true
  https_version        = "2.0"
  client_cert_required = false

  # Web App Dev
  webapp_dev_name          = "${local.prefix}-webapp-dev"
  always_on_dev            = false
  https_only_dev           = false
  client_cert_required_dev = false

  # App Service settings
  app_name             = "${local.prefix}-webapp"
  app_sp_name          = "${local.prefix}-webapp"
  app_sp_kind          = "Linux"
  asp_sku_tier         = "basic"
  asp_sku_size         = "small"
  asp_reserved         = true
  asp_is_xenon         = false
  asp_zone_redundant   = false
  asp_per_site_scaling = false
  app_service_plan_sku = {
    tier     = "Standard"
    size     = "B2"
    capacity = 1
  }
  app_use_MI = true

  acr_name     = "tpximpactaicontainerreg"
  acr_resource_group = "IAC-TPX-IMPACTAI-DEV"

  # Web App Deployment
  webapp_registry_url = "https://${local.acr_name}.azurecr.io"
  webapp_image_name   = "main"
  # Web App Dev Deployment 
  webapp_dev_image_name = "dev"


  # OpenAI
  openai_name           = "${local.prefix}-openai"
  openai_model          = "gpt-4o"
  openai_api_version    = "2024-05-13"
  openai_api_preview_version = "2024-02-15-preview"
  openai_top_p          = 1
  openai_tempreture     = 0
  openai_system_message = "You are a digital assistant for a company called TPXimpact. When referring to our organization, always write \"TPXimpact\" as one word, using capital TPX and lowercase impact. Avoid using \"TPX\" or \"TPX Impact\" and never use \"TPXImpact\". Use British English and exclusively British (UK) English. Strictly follow UK spelling conventions (e.g., use ‘colour’ not ‘color’, ‘realise’ not ‘realize’). Use UK vocabulary and phrases (e.g., ‘flat’ not ‘apartment’, ‘lorry’ not ‘truck’). Apply UK formatting standards. Do not use American English spellings, terms, or formats under any circumstances"

  # OpenAI Embeddings
  openai_embedding_model_name = "text-embedding-ada-002"

  # App Insights
  appinsights_instrumentation_key = "42ab1ba1-3205-4b37-a2af-a01816959fcd"
  appinsights_connection_string   = "InstrumentationKey=42ab1ba1-3205-4b37-a2af-a01816959fcd;IngestionEndpoint=https://uksouth-0.in.applicationinsights.azure.com/;LiveEndpoint=https://uksouth.livediagnostics.monitor.azure.com/;ApplicationId=78a783d9-0b46-435d-94ef-0cdf79fc152f"


}

data "azurerm_container_registry" "acr" {
  name                = local.acr_name
  resource_group_name = local.acr_resource_group
}


resource "azurerm_resource_group" "rg" {
  name     = local.resource_group_name
  location = local.location
}



# Configure Storage Account
resource "azurerm_storage_account" "storage_account" {
  name                     = local.storage_account_name
  resource_group_name      = azurerm_resource_group.rg.name
  location                 = local.location
  account_tier             = local.account_tier
  account_replication_type = local.account_replication_type
  min_tls_version          = local.min_tls_version
  public_network_access_enabled = false
  # Network rules to link Storage Account to VNet
  network_rules {
    default_action             = "Deny"
  }
}

# Cosmos DB
resource "azurerm_cosmosdb_account" "cosmos_db" {
  name                       = local.cosmos_account_name
  location                   = local.location
  resource_group_name        = local.resource_group_name
  offer_type                 = local.cosmos_offer_type
  kind                       = local.cosmos_kind
  analytical_storage_enabled = false
  public_network_access_enabled = false

  consistency_policy {
    consistency_level       = local.cosmos_db_consistency_policy.default_consistency_level
    max_interval_in_seconds = local.cosmos_db_consistency_policy.max_interval_in_seconds
    max_staleness_prefix    = local.cosmos_db_consistency_policy.max_staleness_prefix
  }

  geo_location {
    location          = local.cosmos_db_location
    failover_priority = 0
  }

  backup {
    type                = local.cosmos_bkp_type
    interval_in_minutes = local.cosmos_db_geo_redundant_backup.backup_interval_in_minutes
    retention_in_hours  = local.cosmos_db_geo_redundant_backup.backup_retention_interval_in_hours
    storage_redundancy  = local.cosmos_db_geo_redundant_backup.backup_storage_redundancy
  }
  identity {
    type = "SystemAssigned"
  }
}

resource "azurerm_cosmosdb_sql_database" "sql_db" {
  name                = local.cosmos_sql_db_name
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = azurerm_cosmosdb_account.cosmos_db.name
}

resource "azurerm_cosmosdb_sql_container" "sql_conversations" {
  name                  = local.cosmos_sql_conversations_container_name
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos_db.name
  database_name         = azurerm_cosmosdb_sql_database.sql_db.name
  partition_key_paths   = ["/userId"]
  partition_key_version = 2
  indexing_policy {
    indexing_mode = "consistent"
    # automatic = true # Deprecated command?
    included_path {
      path = "/*"
    }
    excluded_path {
      path = "/\"_etag\"/?"
    }
  }
}
resource "azurerm_cosmosdb_sql_container" "sql_logs" {
  name                  = local.cosmos_sql_logs_container_name
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos_db.name
  database_name         = azurerm_cosmosdb_sql_database.sql_db.name
  partition_key_paths   = ["/userId"]
  partition_key_version = 2
  indexing_policy {
    indexing_mode = "consistent"
    # automatic = true # Deprecated command?
    included_path {
      path = "/*"
    }
    excluded_path {
      path = "/\"_etag\"/?"
    }
  }
}
resource "azurerm_cosmosdb_sql_container" "sql_metadata" {
  name                  = local.cosmos_sql_metadata_container_name
  resource_group_name   = azurerm_resource_group.rg.name
  account_name          = azurerm_cosmosdb_account.cosmos_db.name
  database_name         = azurerm_cosmosdb_sql_database.sql_db.name
  partition_key_paths   = ["/userId"]
  partition_key_version = 2
  indexing_policy {
    indexing_mode = "consistent"
    # automatic = true # Deprecated command?
    included_path {
      path = "/*"
    }
    excluded_path {
      path = "/\"_etag\"/?"
    }
  }


}

data "azurerm_cosmosdb_sql_role_definition" "cosmosdb_contributor_role" {
  role_definition_id  = "00000000-0000-0000-0000-000000000002"
  account_name        = local.cosmos_account_name
  resource_group_name = local.resource_group_name
  depends_on          = [azurerm_cosmosdb_account.cosmos_db]
}



# # Cosmos DB SQL Role Definition - Data Reader Role
# resource "azurerm_cosmosdb_sql_role_definition" "cosmosdb_data_reader_role" {
#   name                = "Cosmos DB Built-in Data Reader"
#   resource_group_name = azurerm_resource_group.rg.name
#   account_name        = local.cosmos_account_name
#   type                = "BuiltInRole"
#   assignable_scopes   = [
#     azurerm_cosmosdb_account.cosmos_db.id
#   ]
#   permissions {
#     data_actions = [
#       "Microsoft.DocumentDB/databaseAccounts/readMetadata",
#       "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/executeQuery",
#       "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/readChangeFeed",
#       "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/read"
#     ]
#   }

#   depends_on = [
#     azurerm_cosmosdb_account.cosmos_db
#   ]
# }

# # Cosmos DB SQL Role Definition - Data Contributor
# resource "azurerm_cosmosdb_sql_role_definition" "cosmosdb_data_contributor_role" {
#   name                = "Cosmos DB Built-in Data Contributor"
#   resource_group_name = azurerm_resource_group.rg.name
#   account_name        = local.cosmos_account_name
#   type                = "BuiltInRole"
#   assignable_scopes   = [
#     azurerm_cosmosdb_account.cosmos_db.id
#   ]

#   permissions {
#     data_actions = [
#       "Microsoft.DocumentDB/databaseAccounts/readMetadata",
#       "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/*",
#       "Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/items/*"
#     ]
#   }

#   depends_on = [
#     azurerm_cosmosdb_account.cosmos_db
#   ]
# }



# Search Service
resource "azurerm_search_service" "search_service" {
  name                          = local.search_service_name
  location                      = local.search_location
  resource_group_name           = local.resource_group_name
  sku                           = local.search_sku
  replica_count                 = local.search_replica_count
  partition_count               = local.search_partition_count
  hosting_mode                  = local.search_hosting_mode
  public_network_access_enabled = local.search_public_network_access
  identity {
    type = "SystemAssigned"
  }
  local_authentication_enabled = true
  authentication_failure_mode = "http401WithBearerChallenge"
  network_rule_bypass_option  = "AzureServices"
  depends_on = [
    azurerm_resource_group.rg
  ]
}




resource "random_password" "webapp_scm_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "random_password" "webappdev_scm_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# App Service Plan
resource "azurerm_service_plan" "app_plan" {
  name                = local.app_sp_name
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  sku_name            = local.sku
  os_type             = local.os_type
}


# Web App
resource "azurerm_linux_web_app" "webapp" {
  name                = local.app_name
  location            = local.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = azurerm_service_plan.app_plan.id
  https_only          = local.https_only

  site_config {
    application_stack {
      docker_image_name   = "${local.webapp_image_name}:latest"
      docker_registry_url = local.webapp_registry_url
    }
    always_on                               = local.always_on
    container_registry_use_managed_identity = true
    websockets_enabled                      = true


  }
  identity {
    type = "SystemAssigned"
  }


  app_settings = {
    "APPINSIGHTS_INSTRUMENTATIONKEY"                  = local.appinsights_instrumentation_key
    "APPINSIGHTS_PROFILERFEATURE_VERSION"             = "1.0.0"
    "APPINSIGHTS_SNAPSHOTFEATURE_VERSION"             = "1.0.0"
    "APPLICATIONINSIGHTS_CONFIGURATION_CONTENT"       = ""
    "APPLICATIONINSIGHTS_CONNECTION_STRING"           = local.appinsights_connection_string
    "ApplicationInsightsAgent_EXTENSION_VERSION"      = "~3"
    "AZURE_COSMOSDB_ACCOUNT"                          = local.cosmos_account_name
    "AZURE_COSMOSDB_CONVERSATIONS_CONTAINER"          = "conversations"
    "AZURE_COSMOSDB_DATABASE"                         = "db_conversation_history"
    "AZURE_COSMOSDB_ENABLE_FEEDBACK"                  = "False"
    "AZURE_OPENAI_EMBEDDING_MODEL_NAME"               = local.openai_embedding_model_name
    "AZURE_OPENAI_EMBEDDING_NAME"                     = azurerm_cognitive_deployment.openai_deployment_embeddings.name
    "AZURE_OPENAI_ENDPOINT"                           = "https://${local.openai_name}.openai.azure.com/"
    "AZURE_OPENAI_KEY"                                = azurerm_cognitive_account.openai.primary_access_key
    "AZURE_OPENAI_MAX_TOKENS"                         = "1500"
    "AZURE_OPENAI_MODEL"                              = azurerm_cognitive_deployment.openai_deployment_gpt4o.name
    "AZURE_OPENAI_MODEL_NAME"                         = local.openai_model
    "AZURE_OPENAI_PREVIEW_API_VERSION"                = local.openai_api_preview_version
    "AZURE_OPENAI_RESOURCE"                           = local.openai_name
    "AZURE_OPENAI_STREAM"                             = "true"
    "AZURE_OPENAI_SYSTEM_MESSAGE"                     = local.openai_system_message
    "AZURE_OPENAI_TEMPERATURE"                        = local.openai_tempreture
    "AZURE_OPENAI_TOP_P"                              = local.openai_top_p
    "AZURE_SEARCH_SERVICE"                            = local.search_service_name
    "AZURE_SEARCH_INDEX"                              = local.search_index_name
    "AZURE_SEARCH_KEY"                                = azurerm_search_service.search_service.primary_key
    "AZURE_SEARCH_TOP_K"                              = local.search_top_k
    "AZURE_SEARCH_URL_COLUMN"                         = "doc_url"
    "AZURE_SEARCH_STRICTNESS"                         = local.search_strictness
    "AZURE_SEARCH_QUERY_TYPE"                         = "vector"
    "AZURE_SEARCH_INDEX_IS_PRECHUNKED"                = "true"
    "AZURE_SEARCH_DOCUMENT_INDEX"                     = "documentindex"
    "AZURE_SEARCH_FILENAME_COLUMN"                    = "filename"
    "AZURE_SEARCH_ENABLE_IN_DOMAIN"                   = "True"
    "AZURE_SEARCH_CONTENT_COLUMNS"                    = "content"
    "AZURE_SEARCH_USE_SEMANTIC_SEARCH"                = "false"
    "AZURE_SEARCH_VECTOR_COLUMNS"                     = "content_vector"
    "AZURE_STORAGE_ACCOUNT"                           = local.storage_account_name
    "AZURE_STORAGE_KEY"                               = azurerm_storage_account.storage_account.primary_access_key
    "DEBUG"                                           = "true"
    "DiagnosticServices_EXTENSION_VERSION"            = "~3"
    "InstrumentationEngine_EXTENSION_VERSION"         = "disabled"
    "XDT_MicrosoftApplicationInsights_BaseExtensions" = "disabled"
    "XDT_MicrosoftApplicationInsights_Mode"           = "recommended"
    "XDT_MicrosoftApplicationInsights_PreemptSdk"     = "disabled"
    "AUTH_ENABLED"                                    = local.app_auth_enabled
    "LOCAL_DEV"                                       = "false"
    "DOCKER_ENABLE_CI"                               = "true"
  }

}


# Web App Dev
resource "azurerm_linux_web_app" "webappdev" {
  name                = "${local.app_name}-dev"
  location            = local.location
  resource_group_name = azurerm_resource_group.rg.name
  service_plan_id     = azurerm_service_plan.app_plan.id
  https_only          = local.https_only

  site_config {
    application_stack {
      docker_image_name        = "${local.webapp_dev_image_name}:latest"
      docker_registry_url      = local.webapp_registry_url
      docker_registry_username = local.acr_name
      docker_registry_password = data.azurerm_container_registry.acr.admin_password
    }
    websockets_enabled                      = true
    always_on                               = local.always_on
    container_registry_use_managed_identity = true
  }
  identity {
    type = "SystemAssigned"
  }
  app_settings = {
    "APPINSIGHTS_INSTRUMENTATIONKEY"                  = local.appinsights_instrumentation_key
    "APPINSIGHTS_PROFILERFEATURE_VERSION"             = "1.0.0"
    "APPINSIGHTS_SNAPSHOTFEATURE_VERSION"             = "1.0.0"
    "APPLICATIONINSIGHTS_CONFIGURATION_CONTENT"       = ""
    "APPLICATIONINSIGHTS_CONNECTION_STRING"           = local.appinsights_connection_string
    "ApplicationInsightsAgent_EXTENSION_VERSION"      = "~3"
    "AZURE_COSMOSDB_ACCOUNT"                          = local.cosmos_account_name
    "AZURE_COSMOSDB_CONVERSATIONS_CONTAINER"          = "conversations"
    "AZURE_COSMOSDB_DATABASE"                         = "db_conversation_history"
    "AZURE_COSMOSDB_ENABLE_FEEDBACK"                  = "False"
    "AZURE_OPENAI_EMBEDDING_MODEL_NAME"               = local.openai_embedding_model_name
    "AZURE_OPENAI_EMBEDDING_NAME"                     = azurerm_cognitive_deployment.openai_deployment_embeddings.name
    "AZURE_OPENAI_ENDPOINT"                           = "https://${local.openai_name}.openai.azure.com/"
    "AZURE_OPENAI_KEY"                                = azurerm_cognitive_account.openai.primary_access_key
    "AZURE_OPENAI_MAX_TOKENS"                         = "1500"
    "AZURE_OPENAI_MODEL"                              = azurerm_cognitive_deployment.openai_deployment_gpt4o.name
    "AZURE_OPENAI_MODEL_NAME"                         = local.openai_model
    "AZURE_OPENAI_PREVIEW_API_VERSION"                = local.openai_api_preview_version
    "AZURE_OPENAI_RESOURCE"                           = local.openai_name
    "AZURE_OPENAI_STREAM"                             = "true"
    "AZURE_OPENAI_SYSTEM_MESSAGE"                     = local.openai_system_message
    "AZURE_OPENAI_TEMPERATURE"                        = local.openai_tempreture
    "AZURE_OPENAI_TOP_P"                              = local.openai_top_p
    "AZURE_SEARCH_SERVICE"                            = local.search_service_name
    "AZURE_SEARCH_KEY"                                = azurerm_search_service.search_service.primary_key
    "AZURE_SEARCH_TOP_K"                              = local.search_top_k
    "AZURE_SEARCH_URL_COLUMN"                         = "doc_url"
    "AZURE_SEARCH_STRICTNESS"                         = local.search_strictness
    "AZURE_SEARCH_QUERY_TYPE"                         = "vector"
    "AZURE_SEARCH_INDEX"                              = local.search_index_name
    "AZURE_SEARCH_INDEX_IS_PRECHUNKED"                = "true"
    "AZURE_SEARCH_DOCUMENT_INDEX"                     = "documentindex"
    "AZURE_SEARCH_FILENAME_COLUMN"                    = "filename"
    "AZURE_SEARCH_ENABLE_IN_DOMAIN"                   = "True"
    "AZURE_SEARCH_CONTENT_COLUMNS"                    = "content"
    "AZURE_SEARCH_USE_SEMANTIC_SEARCH"                = "false"
    "AZURE_SEARCH_VECTOR_COLUMNS"                     = "content_vector"
    "AZURE_STORAGE_ACCOUNT"                           = local.storage_account_name
    "AZURE_STORAGE_KEY"                               = azurerm_storage_account.storage_account.primary_access_key
    "DEBUG"                                           = "true"
    "DiagnosticServices_EXTENSION_VERSION"            = "~3"
    "InstrumentationEngine_EXTENSION_VERSION"         = "disabled"
    "UWSGI_PROCESSES"                                 = "2"
    "UWSGI_THREADS"                                   = "2"
    "WEBSITE_AUTH_AAD_ALLOWED_TENANTS"                = "4f88e6e3-cfad-476a-93fe-8f116c653046"
    "XDT_MicrosoftApplicationInsights_BaseExtensions" = "disabled"
    "XDT_MicrosoftApplicationInsights_Mode"           = "recommended"
    "XDT_MicrosoftApplicationInsights_PreemptSdk"     = "disabled"
    "DEV_MODE"                                        = "True"
    "AUTH_ENABLED"                                    = local.app_auth_enabled
    "DOCKER_ENABLE_CI"                               = "true"
  }
}


resource "azurerm_role_assignment" "openai_user_assignment_dev" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_linux_web_app.webappdev.identity[0].principal_id
}

resource "azurerm_role_assignment" "openai_user_assignment_main" {
  scope                = azurerm_cognitive_account.openai.id
  role_definition_name = "Cognitive Services OpenAI User"
  principal_id         = azurerm_linux_web_app.webapp.identity[0].principal_id
}

# Webhook for main webapp
resource "azurerm_container_registry_webhook" "webapp_webhook" {
  name                = "${local.prefix}webhookmain"
  resource_group_name = local.acr_resource_group
  registry_name       = local.acr_name
  location           = local.location

  service_uri = "https://${azurerm_linux_web_app.webapp.site_credential[0].name}:${azurerm_linux_web_app.webapp.site_credential[0].password}@${azurerm_linux_web_app.webapp.name}.scm.azurewebsites.net/api/registry/webhook"
  
  status = "enabled"
  scope  = "${local.webapp_image_name}:latest" 
  actions = ["push"]

  custom_headers = {
    "Content-Type" = "application/json"
  }
}

# Webhook for dev webapp
resource "azurerm_container_registry_webhook" "webappdev_webhook" {
  name                = "${local.prefix}webhookdev"
  resource_group_name = local.acr_resource_group
  registry_name       = local.acr_name
  location           = local.location
  service_uri         = "https://${azurerm_linux_web_app.webappdev.site_credential[0].name}:${azurerm_linux_web_app.webappdev.site_credential[0].password}@${azurerm_linux_web_app.webappdev.name}.scm.azurewebsites.net/api/registry/webhook"
  
  status = "enabled"
  scope  = "${local.webapp_dev_image_name}:latest" 
  actions = ["push"]

  custom_headers = {
    "Content-Type" = "application/json"
  }
}


resource "azurerm_role_assignment" "cosmod_db_azure_contributor" {
  scope                = azurerm_cosmosdb_account.cosmos_db.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_web_app.webapp.identity.0.principal_id
}

resource "azurerm_role_assignment" "cosmod_db_azure_contributor_dev" {
  scope                = azurerm_cosmosdb_account.cosmos_db.id
  role_definition_name = "Contributor"
  principal_id         = azurerm_linux_web_app.webappdev.identity.0.principal_id
}



# Cosmos DB SQL Role Assignment - Webapp
resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_role_assignment_1" {
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = local.cosmos_account_name
  role_definition_id  = data.azurerm_cosmosdb_sql_role_definition.cosmosdb_contributor_role.id
  principal_id        = azurerm_linux_web_app.webapp.identity[0].principal_id
  scope               = azurerm_cosmosdb_account.cosmos_db.id
  depends_on = [
    azurerm_cosmosdb_account.cosmos_db,
    data.azurerm_cosmosdb_sql_role_definition.cosmosdb_contributor_role
  ]
}


# Cosmos DB SQL Role Assignment - Webapp Dev
resource "azurerm_cosmosdb_sql_role_assignment" "cosmosdb_role_assignment_2" {
  resource_group_name = azurerm_resource_group.rg.name
  account_name        = local.cosmos_account_name
  role_definition_id  = data.azurerm_cosmosdb_sql_role_definition.cosmosdb_contributor_role.id
  principal_id        = azurerm_linux_web_app.webappdev.identity[0].principal_id
  scope               = azurerm_cosmosdb_account.cosmos_db.id
  depends_on = [
    azurerm_cosmosdb_account.cosmos_db,
    data.azurerm_cosmosdb_sql_role_definition.cosmosdb_contributor_role
  ]
}




# OPENAI
resource "azurerm_cognitive_account" "openai" {
  name                  = local.openai_name
  location              = local.location
  resource_group_name   = azurerm_resource_group.rg.name
  kind                  = "OpenAI"
  sku_name              = "S0"
  public_network_access_enabled = false
  custom_subdomain_name = local.openai_name

  identity {
    type = "SystemAssigned"
  }
  network_acls {
    bypass = "AzureServices"
    default_action = "Deny"
  }
}


resource "azurerm_role_assignment" "openai_search_index_data_contributor" {
  scope                = azurerm_search_service.search_service.id
  role_definition_name = "Search Index Data Contributor"
  principal_id         = azurerm_cognitive_account.openai.identity[0].principal_id
  depends_on = [
    azurerm_cognitive_account.openai
  ]
}

resource "azurerm_role_assignment" "openai_search_service_contributor" {
  scope                = azurerm_search_service.search_service.id
  role_definition_name = "Search Service Contributor"
  principal_id         = azurerm_cognitive_account.openai.identity[0].principal_id
  depends_on = [
    azurerm_cognitive_account.openai
  ]
}

resource "azurerm_cognitive_deployment" "openai_deployment_gpt4o" {
  name                 = "${local.openai_name}-4o"
  cognitive_account_id = azurerm_cognitive_account.openai.id
  depends_on           = [azurerm_cognitive_account.openai]
  sku {
    name = "GlobalStandard"
    capacity = 100
  }
  model {
    format  = "OpenAI"
    name    = local.openai_model
    version = local.openai_api_version
  }
  version_upgrade_option = "OnceNewDefaultVersionAvailable"
  rai_policy_name        = "Microsoft.Default"

}

# Azure Cognitive Services Account Deployment for text-embedding-ada-002
resource "azurerm_cognitive_deployment" "openai_deployment_embeddings" {
  name                 = "${local.openai_name}-embeddings"
  cognitive_account_id = azurerm_cognitive_account.openai.id
  depends_on           = [azurerm_cognitive_account.openai]
  sku {
    name = "Standard"
    capacity = 1
  }
  model {
    format  = "OpenAI"
    name    = "text-embedding-ada-002"
    version = "2"
  }
  version_upgrade_option = "OnceNewDefaultVersionAvailable"
  rai_policy_name        = "Microsoft.Default"
}


#Web App permissions and roles
resource "azurerm_role_assignment" "acr_pull" {
  principal_id         = azurerm_linux_web_app.webapp.identity[0].principal_id
  role_definition_name = "AcrPull"
  scope                = data.azurerm_container_registry.acr.id
  depends_on = [
    azurerm_linux_web_app.webapp
  ]

}

resource "azurerm_role_assignment" "acr_pull_dev" {
  principal_id         = azurerm_linux_web_app.webappdev.identity[0].principal_id
  role_definition_name = "AcrPull"
  scope                = data.azurerm_container_registry.acr.id
  depends_on = [
    azurerm_linux_web_app.webappdev
  ]

}


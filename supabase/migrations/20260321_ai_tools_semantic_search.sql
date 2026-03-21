-- =============================================================================
-- AI Tools Semantic Search Migration
-- Enables pgvector extension and creates ai_tools table with embeddings
-- =============================================================================

-- Enable the pgvector extension for similarity search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- =============================================================================
-- AI Tools Table
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.ai_tools (
    -- Core Identity
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    
    -- Classification
    category TEXT NOT NULL,
    subcategory TEXT,
    
    -- Descriptions
    description TEXT,
    
    -- Pricing
    pricing_model TEXT NOT NULL DEFAULT 'unknown',
    pricing_tiers JSONB DEFAULT '{}',
    free_tier JSONB DEFAULT '{"available": false}',
    
    -- Features & Analysis
    key_features TEXT[] DEFAULT '{}',
    pros TEXT[] DEFAULT '{}',
    cons TEXT[] DEFAULT '{}',
    skills TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    
    -- Business Relevance
    forklift_relevance JSONB DEFAULT '{"score": 0}',
    
    -- Technical Details
    api_available BOOLEAN DEFAULT false,
    local_deployment JSONB DEFAULT '{"available": false}',
    
    -- Resources
    video_links JSONB DEFAULT '[]',
    integrations TEXT[] DEFAULT '{}',
    
    -- Recommendation
    status TEXT,
    recommendation_tier TEXT,
    
    -- Metadata
    source_file TEXT,
    last_updated DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- =============================================================================
    -- SEMANTIC SEARCH FIELDS
    -- =============================================================================
    
    -- Combined text for embedding generation (description + features + use cases)
    searchable_text TEXT GENERATED ALWAYS AS (
        COALESCE(name, '') || ' ' ||
        COALESCE(description, '') || ' ' ||
        COALESCE(category, '') || ' ' ||
        COALESCE(subcategory, '') || ' ' ||
        COALESCE(array_to_string(key_features, ' '), '') || ' ' ||
        COALESCE(array_to_string(skills, ' '), '') || ' ' ||
        COALESCE(array_to_string(tags, ' '), '') || ' ' ||
        COALESCE((forklift_relevance->>'notes')::TEXT, '') || ' ' ||
        COALESCE(array_to_string((SELECT array_agg(x) FROM jsonb_array_elements_text(forklift_relevance->'use_cases') AS x), ' '), '')
    ) STORED,
    
    -- OpenAI text-embedding-3-small produces 1536-dimensional vectors
    embedding vector(1536)
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Standard B-tree indexes
CREATE INDEX IF NOT EXISTS idx_ai_tools_category ON public.ai_tools(category);
CREATE INDEX IF NOT EXISTS idx_ai_tools_pricing_model ON public.ai_tools(pricing_model);
CREATE INDEX IF NOT EXISTS idx_ai_tools_recommendation_tier ON public.ai_tools(recommendation_tier);
CREATE INDEX IF NOT EXISTS idx_ai_tools_status ON public.ai_tools(status);

-- GIN indexes for array/JSONB fields
CREATE INDEX IF NOT EXISTS idx_ai_tools_tags ON public.ai_tools USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_ai_tools_integrations ON public.ai_tools USING GIN(integrations);
CREATE INDEX IF NOT EXISTS idx_ai_tools_skills ON public.ai_tools USING GIN(skills);

-- Full-text search index (for hybrid search)
CREATE INDEX IF NOT EXISTS idx_ai_tools_fts ON public.ai_tools 
    USING GIN(to_tsvector('english', searchable_text));

-- Vector similarity search index (IVFFlat for production, HNSW for faster queries)
-- Using IVFFlat: good balance of speed and accuracy
-- lists = number of clusters (sqrt of expected rows is a good starting point)
CREATE INDEX IF NOT EXISTS idx_ai_tools_embedding ON public.ai_tools 
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);

-- =============================================================================
-- Similarity Search Function
-- =============================================================================

-- Main semantic search function
CREATE OR REPLACE FUNCTION search_ai_tools(
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 20,
    filter_category TEXT DEFAULT NULL,
    filter_pricing_model TEXT DEFAULT NULL,
    filter_recommendation_tier TEXT DEFAULT NULL,
    filter_has_free_tier BOOLEAN DEFAULT NULL,
    filter_has_api BOOLEAN DEFAULT NULL,
    filter_tags TEXT[] DEFAULT NULL
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    subcategory TEXT,
    description TEXT,
    pricing_model TEXT,
    pricing_tiers JSONB,
    free_tier JSONB,
    key_features TEXT[],
    pros TEXT[],
    cons TEXT[],
    skills TEXT[],
    tags TEXT[],
    forklift_relevance JSONB,
    api_available BOOLEAN,
    local_deployment JSONB,
    video_links JSONB,
    integrations TEXT[],
    status TEXT,
    recommendation_tier TEXT,
    source_file TEXT,
    last_updated DATE,
    similarity FLOAT,
    match_reasons TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_tools AS (
        SELECT 
            t.id,
            t.name,
            t.category,
            t.subcategory,
            t.description,
            t.pricing_model,
            t.pricing_tiers,
            t.free_tier,
            t.key_features,
            t.pros,
            t.cons,
            t.skills,
            t.tags,
            t.forklift_relevance,
            t.api_available,
            t.local_deployment,
            t.video_links,
            t.integrations,
            t.status,
            t.recommendation_tier,
            t.source_file,
            t.last_updated,
            -- Cosine similarity (1 - distance for cosine)
            1 - (t.embedding <=> query_embedding) AS similarity,
            -- Build match reasons array
            ARRAY_REMOVE(ARRAY[
                CASE WHEN t.name ILIKE '%' || split_part(t.searchable_text, ' ', 1) || '%' 
                    THEN 'Name matches' END,
                CASE WHEN t.category = filter_category 
                    THEN 'Category: ' || t.category END,
                CASE WHEN t.recommendation_tier = 'tier_1_essential' 
                    THEN 'Essential tool' END,
                CASE WHEN (t.free_tier->>'available')::boolean = true 
                    THEN 'Has free tier' END,
                CASE WHEN t.api_available = true 
                    THEN 'API available' END,
                CASE WHEN (t.forklift_relevance->>'score')::int >= 8 
                    THEN 'High forklift relevance' END
            ], NULL) AS match_reasons
        FROM public.ai_tools t
        WHERE 
            -- Only include tools with embeddings
            t.embedding IS NOT NULL
            -- Apply threshold
            AND (1 - (t.embedding <=> query_embedding)) >= match_threshold
            -- Apply optional filters
            AND (filter_category IS NULL OR t.category = filter_category)
            AND (filter_pricing_model IS NULL OR t.pricing_model = filter_pricing_model)
            AND (filter_recommendation_tier IS NULL OR t.recommendation_tier = filter_recommendation_tier)
            AND (filter_has_free_tier IS NULL OR (t.free_tier->>'available')::boolean = filter_has_free_tier)
            AND (filter_has_api IS NULL OR t.api_available = filter_has_api)
            AND (filter_tags IS NULL OR t.tags && filter_tags)
        ORDER BY similarity DESC
        LIMIT match_count
    )
    SELECT * FROM ranked_tools;
END;
$$;

-- =============================================================================
-- Hybrid Search Function (Semantic + Keyword)
-- =============================================================================

CREATE OR REPLACE FUNCTION hybrid_search_ai_tools(
    query_embedding vector(1536),
    query_text TEXT,
    semantic_weight FLOAT DEFAULT 0.7,
    keyword_weight FLOAT DEFAULT 0.3,
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    description TEXT,
    similarity FLOAT,
    keyword_rank FLOAT,
    combined_score FLOAT,
    match_reasons TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH semantic_results AS (
        SELECT 
            t.id,
            t.name,
            t.category,
            t.description,
            1 - (t.embedding <=> query_embedding) AS semantic_similarity
        FROM public.ai_tools t
        WHERE t.embedding IS NOT NULL
    ),
    keyword_results AS (
        SELECT 
            t.id,
            ts_rank_cd(to_tsvector('english', t.searchable_text), plainto_tsquery('english', query_text)) AS keyword_rank
        FROM public.ai_tools t
        WHERE to_tsvector('english', t.searchable_text) @@ plainto_tsquery('english', query_text)
    ),
    combined AS (
        SELECT 
            s.id,
            s.name,
            s.category,
            s.description,
            s.semantic_similarity,
            COALESCE(k.keyword_rank, 0) AS keyword_rank,
            (s.semantic_similarity * semantic_weight) + (COALESCE(k.keyword_rank, 0) * keyword_weight) AS combined_score,
            ARRAY_REMOVE(ARRAY[
                CASE WHEN s.semantic_similarity >= 0.7 THEN 'Strong semantic match' 
                     WHEN s.semantic_similarity >= 0.5 THEN 'Good semantic match'
                     ELSE NULL END,
                CASE WHEN k.keyword_rank > 0 THEN 'Keyword match' ELSE NULL END
            ], NULL) AS match_reasons
        FROM semantic_results s
        LEFT JOIN keyword_results k ON s.id = k.id
        WHERE s.semantic_similarity >= match_threshold
           OR k.keyword_rank > 0
    )
    SELECT * FROM combined
    ORDER BY combined_score DESC
    LIMIT match_count;
END;
$$;

-- =============================================================================
-- Helper Functions
-- =============================================================================

-- Function to get tools by integration capability
CREATE OR REPLACE FUNCTION get_tools_by_integration(integration_name TEXT)
RETURNS SETOF public.ai_tools
LANGUAGE sql
AS $$
    SELECT * FROM public.ai_tools
    WHERE integration_name = ANY(integrations)
    ORDER BY (forklift_relevance->>'score')::int DESC NULLS LAST;
$$;

-- Function to get related tools (same category or shared integrations)
CREATE OR REPLACE FUNCTION get_related_tools(tool_id TEXT, limit_count INT DEFAULT 5)
RETURNS TABLE (
    id TEXT,
    name TEXT,
    category TEXT,
    reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    source_tool RECORD;
BEGIN
    -- Get the source tool
    SELECT * INTO source_tool FROM public.ai_tools WHERE ai_tools.id = tool_id;
    
    IF source_tool IS NULL THEN
        RETURN;
    END IF;
    
    RETURN QUERY
    SELECT DISTINCT
        t.id,
        t.name,
        t.category,
        CASE 
            WHEN t.category = source_tool.category THEN 'Same category'
            WHEN t.integrations && source_tool.integrations THEN 'Shared integrations'
            ELSE 'Similar'
        END AS reason
    FROM public.ai_tools t
    WHERE t.id != tool_id
    AND (
        t.category = source_tool.category
        OR t.integrations && source_tool.integrations
    )
    ORDER BY 
        (t.forklift_relevance->>'score')::int DESC NULLS LAST,
        t.name
    LIMIT limit_count;
END;
$$;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (tools database is public)
CREATE POLICY "AI tools are viewable by everyone" 
    ON public.ai_tools FOR SELECT 
    USING (true);

-- Only authenticated users with admin role can modify
CREATE POLICY "Only admins can insert AI tools" 
    ON public.ai_tools FOR INSERT 
    WITH CHECK (
        auth.role() = 'authenticated' 
        AND (auth.jwt() ->> 'role') = 'admin'
    );

CREATE POLICY "Only admins can update AI tools" 
    ON public.ai_tools FOR UPDATE 
    USING (
        auth.role() = 'authenticated' 
        AND (auth.jwt() ->> 'role') = 'admin'
    );

CREATE POLICY "Only admins can delete AI tools" 
    ON public.ai_tools FOR DELETE 
    USING (
        auth.role() = 'authenticated' 
        AND (auth.jwt() ->> 'role') = 'admin'
    );

-- =============================================================================
-- Trigger for updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ai_tools_updated_at
    BEFORE UPDATE ON public.ai_tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Comments for documentation
-- =============================================================================

COMMENT ON TABLE public.ai_tools IS 'AI tools database with semantic search capabilities using pgvector';
COMMENT ON COLUMN public.ai_tools.embedding IS 'OpenAI text-embedding-3-small vector (1536 dimensions)';
COMMENT ON COLUMN public.ai_tools.searchable_text IS 'Combined text fields for embedding generation';
COMMENT ON FUNCTION search_ai_tools IS 'Semantic similarity search for AI tools using cosine distance';
COMMENT ON FUNCTION hybrid_search_ai_tools IS 'Combined semantic + keyword search with configurable weights';

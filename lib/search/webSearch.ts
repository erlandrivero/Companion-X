/**
 * Web Search Integration
 * Provides web search capabilities for agent creation, skill creation, and responses
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  publishedDate?: string;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
  totalResults: number;
}

/**
 * Search the web using Brave Search API
 * Free tier: 2000 queries/month
 */
export async function searchWeb(
  query: string,
  count: number = 5,
  apiKey?: string
): Promise<SearchResponse> {
  const braveApiKey = apiKey || process.env.BRAVE_SEARCH_API_KEY;
  
  if (!braveApiKey) {
    console.warn("⚠️ No Brave Search API key found, returning empty results");
    return {
      results: [],
      query,
      totalResults: 0,
    };
  }

  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.append("q", query);
    url.searchParams.append("count", count.toString());
    url.searchParams.append("text_decorations", "false");
    url.searchParams.append("search_lang", "en");

    console.log("🔍 Searching web for:", query);

    const response = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": braveApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status}`);
    }

    const data = await response.json();
    
    const results: SearchResult[] = (data.web?.results || []).map((result: any) => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
      publishedDate: result.age,
    }));

    console.log(`✅ Found ${results.length} search results`);

    return {
      results,
      query,
      totalResults: data.web?.results?.length || 0,
    };
  } catch (error) {
    console.error("Web search error:", error);
    return {
      results: [],
      query,
      totalResults: 0,
    };
  }
}

/**
 * Format search results for AI consumption
 */
export function formatSearchResults(searchResponse: SearchResponse): string {
  if (searchResponse.results.length === 0) {
    return "No web search results available.";
  }

  let formatted = `Web Search Results for "${searchResponse.query}":\n\n`;
  
  searchResponse.results.forEach((result, index) => {
    formatted += `${index + 1}. ${result.title}\n`;
    formatted += `   URL: ${result.url}\n`;
    formatted += `   ${result.snippet}\n`;
    if (result.publishedDate) {
      formatted += `   Published: ${result.publishedDate}\n`;
    }
    formatted += `\n`;
  });

  return formatted;
}

/**
 * Extract key information from search results
 */
export function extractKeyInfo(searchResponse: SearchResponse): string {
  if (searchResponse.results.length === 0) {
    return "";
  }

  const snippets = searchResponse.results
    .map(r => r.snippet)
    .join(" ");

  return snippets;
}

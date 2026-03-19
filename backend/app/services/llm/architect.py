import os
from anthropic import Anthropic
from app.schemas.analysis import EconomicAnalysis
from dotenv import load_dotenv



load_dotenv()

class EconomicArchitect:
    def __init__(self):
        self.client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        self.model = "claude-3-5-sonnet-20240620"

    def analyze_news(self, news_content: str) -> EconomicAnalysis:
        system_prompt = """
        You are the 'Economic Architect', an expert in the South Korean food supply chain.
        Your task is to bridge the 'Interpretation Gap' for small business owners.
        
        CRITICAL INSTRUCTIONS:
        1. ANALYZE: Map global news to specific Korean SME costs.
        2. CAUSAL CHAIN: Use at least 4 steps (Origin -> Macro -> Wholesale -> Local Shop).
        3. GREEDFLATION AUDIT: Evaluate if the news is a legitimate cost-driver or a 'Rocket & Feather' pretext.
        4. TONE: Professional, empowering, and protective of the 'little guy'.
        5. OUTPUT: You must return a valid JSON object matching the requested schema.
        """

        # Using Claude's tool-use for forced JSON structure
        response = self.client.messages.create(
            model=self.model,
            max_tokens=2000,
            system=system_prompt,
            messages=[
                {"role": "user", "content": f"Analyze this news for a restaurant owner: {news_content}"}
            ],
            tools=[{
                "name": "record_economic_analysis",
                "description": "Records the structured economic impact analysis.",
                "input_schema": EconomicAnalysis.model_json_schema()
            }],
            tool_choice={"type": "tool", "name": "record_economic_analysis"}
        )

        # Extracting the structured data from the tool call
        analysis_data = response.content[0].input
        return EconomicAnalysis(**analysis_data)

# Usage Example:
# architect = EconomicArchitect()
# report = architect.analyze_news("Panama Canal drought worsens; shipping lanes restricted.")
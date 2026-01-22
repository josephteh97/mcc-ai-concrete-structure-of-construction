# This is a placeholder for the Vision Model integration (Qwen3-VL / Claude Sonnet 4.5)
# Actual implementation requires model weights or API keys.

import requests
import base64
import os

from processing_unit.system_manager import SystemManager, SystemStatus

class VisionReasoner:
    def __init__(self, model_type: str = "qwen-vl"):
        self.model_type = model_type
        # In a real scenario, we would inject the SystemManager instance or get the singleton
        self.system = SystemManager() 
        pass

    async def chat_with_user(self, message: str) -> dict:
        """
        Process a text message from the user, simulating a VL/LLM agent (RPA Manager).
        It can inspect system state and trigger actions.
        """
        message_lower = message.lower()
        response = {
            "reply": "I received your message.",
            "updated_params": {}
        }
        
        # Regular expressions for parameter extraction
        import re
        
        # 1. System Status Check
        if "status" in message_lower or "what is happening" in message_lower:
            status = self.system.status.value
            last_log = self.system.logs[-1] if self.system.logs else "No logs yet."
            response["reply"] = f"Manager: Current System Status is [{status.upper()}].\nLast Activity: {last_log}"
            return response

        # 2. Configuration Updates
        
        # Floor Count
        floor_match = re.search(r"(\d+)\s*floor", message_lower)
        if floor_match:
            count = int(floor_match.group(1))
            self.system.update_config("floor_count", count)
            response["updated_params"]["floor_count"] = count
            response["reply"] = f"Manager: I've updated the plan to {count} floors."

        # Confidence Threshold (e.g., "set threshold to 0.1", "conf 0.2")
        conf_match = re.search(r"(?:threshold|conf|confidence)\s*(?:to|is|=)?\s*([0-9]*\.?[0-9]+)", message_lower)
        if conf_match:
            try:
                val = float(conf_match.group(1))
                if 0 < val < 1.0:
                    self.system.update_config("conf_threshold", val)
                    response["updated_params"]["conf_threshold"] = val
                    response["reply"] = f"Manager: Confidence threshold set to {val}. This might help detect more (or fewer) objects."
                else:
                    response["reply"] = "Manager: Confidence threshold must be between 0 and 1."
            except ValueError:
                pass

        # 3. Intervention / Workflow Control
        if "retry" in message_lower or "resume" in message_lower or "try again" in message_lower:
            if self.system.status == SystemStatus.PAUSED:
                response["reply"] = "Manager: Understood. I am intervening to resume the workflow with the current settings..."
                # Trigger the resume asynchronously
                # Since we are in an async function, we can await it if we want the result immediately,
                # or just fire it. Since we want to report success/fail, we await.
                result = await self.system.resume_workflow()
                
                if result.get("status") == "success":
                    response["reply"] += f"\nSuccess! Process completed. Download: {result.get('ifc_url')}"
                elif result.get("status") == "paused":
                    response["reply"] += f"\nStill no luck. Reason: {result.get('message')}"
                else:
                    response["reply"] += f"\nError encountered: {result.get('message')}"
                return response
            else:
                 response["reply"] = "Manager: The system is not currently paused, so there is nothing to resume. You can upload a new file."

        # If we updated params but didn't trigger resume (and we are paused), suggest it
        elif response["updated_params"] and self.system.status == SystemStatus.PAUSED:
             response["reply"] += "\n(System is PAUSED. Say 'retry' to apply these changes to the current job.)"

        # Fallback / General Info
        elif response["reply"] == "I received your message.":
             response["reply"] = "Manager: I am monitoring the workflow. You can ask me to change settings (e.g., 'set floors to 5', 'threshold 0.1') or 'retry' a failed job."

        return response

    def analyze_structure(self, image_path: str, prompt: str) -> str:
        """
        Analyze the image using the VLM to understand spatial relationships.
        
        Args:
            image_path (str): Path to the engineering drawing.
            prompt (str): Question or instruction for the model.
            
        Returns:
            str: The model's textual analysis.
        """
        # Mock response for development without heavy model weights
        return f"Mock Analysis: The image contains a structural layout with columns arranged in a grid. Detected beam connections between columns."

    def _analyze_with_claude(self, image_path: str, prompt: str, api_key: str):
        # Implementation for Claude 3/4.5 Vision API
        pass
    
    def _analyze_with_qwen(self, image_path: str, prompt: str):
        # Implementation for Qwen-VL local inference
        pass

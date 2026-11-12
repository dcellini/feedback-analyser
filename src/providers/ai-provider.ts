export interface AIProvider {
  analyzeFeedback(feedback: string): Promise<string>;
}

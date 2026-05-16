// Deduplica chiamate AI

export const inFlightAIRequests = new Map();

export function dedupeAIRequest(key, factory) {
	if (inFlightAIRequests.has(key)) {
		return inFlightAIRequests.get(key);
	}
	const promise = factory().finally(() => inFlightAIRequests.delete(key));
	inFlightAIRequests.set(key, promise);
	return promise;
}

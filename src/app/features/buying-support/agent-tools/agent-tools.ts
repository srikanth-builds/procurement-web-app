export const productOptionsTool = {
  name: 'show_products_to_user',
  description: 'Use this tool to show a list of product options to the user',
  parameters: {
    type: 'object',
    properties: {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            vendor: { type: 'string' },
            price: { type: 'number' },
            image_url: { type: 'string' },
            source_url: { type: 'string' },
            status: {
              type: 'string',
              enum: ['Recommended', 'Consider', 'Available'],
              description: 'Product recommendation status'
            },
            specifications: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string' },
                  value: { type: 'string' },
                },
                required: ['key', 'value'],
              },
            },
          },
          required: ['name', 'description', 'vendor', 'price', 'image_url', 'source_url', 'specifications'],
        },
      },
    },
    required: ['products'],
  },
};

export const suggestionTool = {
  name: 'show_suggestions',
  description: 'Use this tool to show a list of suggestions to the user to guide their next actions.',
  parameters: {
    type: 'object',
    properties: {
      suggestions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['suggestions'],
  },
};

export const supplierListTool = {
  name: 'supplier_list',
  description: 'Use this tool to show a list of recommended suppliers to the user',
  parameters: {
    type: 'object',
    properties: {

      suppliers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            contact: { type: 'string' },
            rating: { type: 'number' },
            location: { type: 'string' },
            status: {
              type: 'string',
              enum: ['Preferred', 'Approved', 'Probation', 'New'],
            },
            website: { type: 'string' },
          },
          required: ['id', 'name', 'contact', 'rating', 'location', 'status'],
        },
      },
    },
    required: ['suppliers'],
  },
};

export const updatePrTool = {
  name: 'update_pr_state',
  description: 'This tool is to update the UI state of the Purchase Requisition (PR) form. Use this to add, update, or remove items/suppliers, or update justification/delivery date based on user request.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'remove'],
        description: 'The action to perform: "add" to add new items/suppliers (default), "update" to modify existing items (e.g., quantity), "remove" to delete items/suppliers from the PR.'
      },
      purchase_request_id: { type: 'string', description: 'The ID of the purchase requisition (e.g. PR-2024-001)' },
      justification: { type: 'string', description: 'Justification for the purchase' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'number' }
          },
          required: ['name']
        },
        description: 'List of products. For "add": adds to PR (requires quantity). For "update": modifies quantity. For "remove": removes from PR (only name needed). IMPORTANT: Only call with "add" AFTER you have shown products using "show_products_to_user".'
      },
      suppliers: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of supplier names. For "add": adds to PR. For "remove": removes from PR. IMPORTANT: Only call with "add" AFTER you have shown the supplier list using "supplier_list".'
      },
      expectedDelivery: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' }
    },
  },
};

export const askUserConfirmationTool = {
  name: 'ask_user_confirmation',
  description: 'Use this tool to ask the user for confirmation before performing a sensitive action or when you need explicit approval. The user can respond with Yes, No, or provide refinement.',
  parameters: {
    type: 'object',
    properties: {
      descriptive_action: {
        type: 'string',
        description: 'A clear, concise description of the action you are about to perform, which the user needs to confirm. E.g., "Submit the purchase requisition for $500?"'
      }
    },
    required: ['descriptive_action']
  }
};

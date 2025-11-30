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
    description: 'This tool is to update the UI state of the Purchase Requisition (PR) form. Use this to add items, suppliers, or update justification/delivery date based on user request.',
    parameters: {
        type: 'object',
        properties: {
            justification: { type: 'string', description: 'Justification for the purchase' },
            items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        quantity: { type: 'number' }
                    },
                    required: ['name', 'quantity']
                },
                description: 'List of products to add to the PR. IMPORTANT: Only call this AFTER you have shown products to the user using "show_products_to_user".'
            },
            suppliers: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of supplier names to add to the PR. IMPORTANT: Only call this AFTER you have shown the supplier list using "supplier_list".'
            },
            expectedDelivery: { type: 'string', description: 'Expected delivery date (YYYY-MM-DD)' }
        },
    },
};

export const fallbackLetterTypes = [
  {
    label: 'Certification reimbursement',
    value: 'certification',
    description: 'Confirm an approved professional certification reimbursement.',
    fields: [
      { name: 'courseName', label: 'Course or certification', type: 'text' },
      { name: 'amount', label: 'Reimbursement amount', type: 'number' },
      { name: 'institute', label: 'Institution', type: 'text' },
    ],
  },
  {
    label: 'HR letter',
    value: 'hr_letter',
    description: 'Request a general employment confirmation for a third party.',
    fields: [
      { name: 'recipientName', label: 'Recipient name', type: 'text' },
      { name: 'recipientAddress', label: 'Recipient address', type: 'text' },
      { name: 'purpose', label: 'Purpose', type: 'text' },
    ],
  },
  {
    label: 'Internship completion',
    value: 'internship_completion',
    description: 'Confirm completion and dates of an internship.',
    fields: [
      { name: 'internshipRole', label: 'Internship role', type: 'text' },
      { name: 'startDate', label: 'Start date', type: 'date' },
      { name: 'endDate', label: 'End date', type: 'date' },
    ],
  },
  {
    label: 'Travel NOC',
    value: 'travel_noc',
    description: 'Request a no-objection certificate for business or personal travel.',
    fields: [
      { name: 'purpose', label: 'Purpose of travel', type: 'text' },
      { name: 'destination', label: 'Destination', type: 'text' },
      { name: 'travelStart', label: 'Travel start', type: 'date' },
      { name: 'travelEnd', label: 'Travel end', type: 'date' },
    ],
  },
  {
    label: 'Visa letter',
    value: 'visa',
    description: 'Request employment confirmation to support a visa application.',
    fields: [
      { name: 'country', label: 'Destination country', type: 'text' },
      { name: 'duration', label: 'Duration of stay', type: 'text' },
      { name: 'purpose', label: 'Purpose of visit', type: 'text' },
    ],
  },
];

export function mergeLetterTypes(templates = []) {
  const fallbacks = new Map(fallbackLetterTypes.map((type) => [type.value, type]));
  return templates
    .filter((template) => template.isActive !== false)
    .map((template) => {
      const fallback = fallbacks.get(template.value);
      return {
        ...fallback,
        ...template,
        fields: template.fields?.length ? template.fields : fallback?.fields || [],
      };
    });
}

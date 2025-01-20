# Certificate Creation Flow

## Modes of Certificate Creation

### 1. Single Certificate Creation

#### Form Fields:
- Certificate Name
- Certificate Groups (comma-separated)
- Optional Certificate Password
- Admin Status

**Features:**
- Ability to generate multiple single certificates at once

### 2. Batch Certificate Creation

#### Form Fields:
- Base Name
- Groups (comma-separated)
- Suffix Type Options:
  - Numeric
  - Alphabetic
- Number of Certificates to Generate

**Features:**
- Generates a sequence of certificates with a common base name and suffix.


for frontend we need to have a toggle for the two modes
a switch for the admin status for single certificate creation
use shadcn switch component
use shadcn input component for fields
organize in a card component making it look nice with configuration being easy. 

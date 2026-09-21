"""
GHL Custom Field Setup Script.
Ensures all Vulpine-specific custom fields exist in GoHighLevel.
Run once during initial setup: python -m services.ghl_bridge.setup_fields
"""

import asyncio
import sys
sys.path.insert(0, "/opt/vulpine-engine")

from services.ghl_bridge.client import ghl
from services.ghl_bridge.custom_fields import get_all_field_definitions
from loguru import logger


async def setup_fields():
    """Check and create missing custom fields in GHL."""
    logger.info("Checking GHL custom fields...")

    try:
        existing = await ghl.list_custom_fields()
    except Exception as e:
        logger.error(f"Cannot fetch existing fields: {e}")
        return

    existing_names = {f.get("name") for f in existing}
    needed = get_all_field_definitions()

    created = 0
    skipped = 0

    for field_def in needed:
        name = field_def["name"]
        if name in existing_names:
            logger.debug(f"  ✓ {name}")
            skipped += 1
            continue

        try:
            await ghl.create_custom_field(field_def)
            logger.info(f"  + Created: {name}")
            created += 1
        except Exception as e:
            logger.error(f"  ✗ Failed {name}: {e}")

    logger.info(f"Custom fields: {created} created, {skipped} already exist, {len(needed)} total")


if __name__ == "__main__":
    asyncio.run(setup_fields())

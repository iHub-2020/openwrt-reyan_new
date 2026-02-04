# Changelog - LuCI UDP Tunnel Manager

All notable changes to this project will be documented in this file.

## [2.1.0] - 2026-01-30

### Added
- Reset button with confirmation dialog for clearing all configurations
- Immediate service control when toggling "Enable Service"
- Enhanced user experience with unified service control

### Changed
- Merged "Enable Service" with immediate service control
- Changed bottom button from "Start/Stop Process" to "Reset"
- Removed service start success notifications for cleaner UX

### Fixed
- Button stability issues with periodic checks
- Service control flow improvements

## [2.0.0] - 2026-01-16

### Added
- Aligned with official udp2raw documentation
- Missing cipher_mode: aes128cfb
- Missing auth_mode: md5, crc32
- Missing raw_mode: easy-faketcp
- Missing seq_mode: 0, 1, 2

### Changed
- Defaults to match official: cipher_mode=aes128cbc, auth_mode=md5

## [1.9.8] - Previous Versions

### Fixed
- Button stability - periodic check + immediate application
- Button position stability - use onclick property instead of clone
- Button click handler - replace event listener completely
- MutationObserver TypeError - use requestAnimationFrame instead

## Status Page Changelog

### [2.8] - 2026-01-15
- Changed "Core Binary" to display actual MD5 checksum instead of version
- Added getMD5() function to calculate /usr/bin/udp2raw MD5 hash

### [2.7]
- Fixed Iptables Rules to display ACTUAL chain names (e.g. udp2rawDwrW_...) instead of count
- Fixed "Last updated" text color by removing inline styles completely

### [2.6]
- Reverted label to "Iptables Rules"
- Enhanced Iptables detection

### [2.5]
- Improved "Core Binary" detection logic